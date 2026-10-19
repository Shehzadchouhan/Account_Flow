import { NextRequest, NextResponse } from 'next/server'
import { assertAuth } from '@/utils/auth'
import { createClient } from '@/utils/supabase/server'
import {
  getReportData,
  type ReportType,
  type ReportFilterParams,
} from '@/lib/reports-data'
import {
  generateExcelBuffer,
  generateCsvString,
} from '@/lib/export-utils'
import { getTodayIST } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await assertAuth()
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const reportType = searchParams.get('report') as ReportType | null
    const format = searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'

    if (!reportType) {
      return NextResponse.json({ error: 'Missing report type parameter.' }, { status: 400 })
    }

    const validReports: ReportType[] = [
      'pending_documents',
      'completed_cases',
      'dispatch_history',
      'work_by_employee',
      'received_not_dispatched',
      'overdue_cases',
    ]

    if (!validReports.includes(reportType)) {
      return NextResponse.json({ error: `Invalid report type: ${reportType}` }, { status: 400 })
    }

    const filters: ReportFilterParams = {
      firm_id: searchParams.get('firm_id') || undefined,
      employee: searchParams.get('employee') || undefined,
      document_type_id: searchParams.get('document_type_id') || undefined,
      status: searchParams.get('status') || undefined,
      cycle: searchParams.get('cycle') || undefined,
      month: searchParams.get('month') || undefined,
      due_date_from: searchParams.get('due_date_from') || undefined,
      due_date_to: searchParams.get('due_date_to') || undefined,
    }

    // 2. Fetch and format report data from real-time database views
    const dataset = await getReportData(supabase, reportType, filters)

    // 3. Log export activity in activity_logs (append-only audit trail)
    try {
      await supabase.rpc('log_export_activity', {
        p_report_name: reportType,
        p_filters: filters as unknown as Record<string, unknown>,
        p_row_count: dataset.data.length,
      })
    } catch (auditErr) {
      console.error('Failed to log export activity:', auditErr)
      // Do not abort user file download if audit log write encountered non-fatal error
    }

    const dateStr = getTodayIST()
    const baseFilename = `FinanceFlow_${dataset.reportName}_${dateStr}`

    // 4. Generate response in requested format (.csv or .xlsx)
    if (format === 'csv') {
      const csvString = generateCsvString(dataset.columns, dataset.data)
      return new NextResponse(csvString, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseFilename}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const excelBuffer = await generateExcelBuffer(
      dataset.sheetTitle,
      dataset.columns,
      dataset.data
    )

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${baseFilename}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    console.error('Export error:', err)
    const message = err instanceof Error ? err.message : 'Export failed'
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
