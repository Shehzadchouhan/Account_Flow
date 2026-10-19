import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/utils/auth'
import {
  generateExcelBuffer,
  generateCsvString,
  IMPORT_TEMPLATE_COLUMNS,
  IMPORT_TEMPLATE_SAMPLE_DATA,
} from '@/lib/export-utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Admin only guard
    await assertAdmin()

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'

    if (format === 'csv') {
      const csvContent = generateCsvString(
        IMPORT_TEMPLATE_COLUMNS,
        IMPORT_TEMPLATE_SAMPLE_DATA
      )
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="FinanceFlow_Firms_Import_Template.csv"',
        },
      })
    }

    const excelBuffer = await generateExcelBuffer(
      'Firms Template',
      IMPORT_TEMPLATE_COLUMNS,
      IMPORT_TEMPLATE_SAMPLE_DATA
    )

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="FinanceFlow_Firms_Import_Template.xlsx"',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unauthorized'
    const status = message.includes('Forbidden') ? 403 : 401
    return NextResponse.json({ error: message }, { status })
  }
}
