import ExcelJS from 'exceljs'

/**
 * Neutralizes spreadsheet formula injection (CWE-1236 / CSV Injection).
 * Any string beginning with '=', '+', '-', '@', horizontal tab, or carriage return
 * is prefixed with a single quotation mark (') to force spreadsheet applications
 * (Excel, Calc, Sheets) to treat the cell strictly as literal plain text without evaluating.
 */
export function sanitizeCellForFormulaInjection(val: unknown): unknown {
  if (val === null || val === undefined) {
    return ''
  }
  if (typeof val !== 'string') {
    return val
  }
  const str = val
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r']
  if (dangerousPrefixes.some((prefix) => str.startsWith(prefix))) {
    return `'${str}`
  }
  return str
}

export interface ColumnDefinition {
  header: string
  key: string
  width?: number
}

/**
 * Builds an Excel (.xlsx) file buffer from tabular records.
 * Ensures all cell strings are sanitized against formula injection.
 */
export async function generateExcelBuffer(
  sheetName: string,
  columns: ColumnDefinition[],
  data: Record<string, unknown>[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FinanceFlow'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  // Set columns
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || Math.max(col.header.length + 4, 15),
  }))

  // Style header row
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FF0F172A' }, size: 11 }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  }
  headerRow.alignment = { vertical: 'middle' }
  headerRow.height = 24

  // Add data rows with formula injection neutralization
  data.forEach((row) => {
    const sanitizedRow: Record<string, unknown> = {}
    columns.forEach((col) => {
      const rawVal = row[col.key]
      sanitizedRow[col.key] = sanitizeCellForFormulaInjection(rawVal ?? '')
    })
    worksheet.addRow(sanitizedRow)
  })

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Builds a CSV (.csv) string from tabular records.
 * Prepends UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
 * and neutralizes formula injection on all cell strings.
 */
export function generateCsvString(
  columns: ColumnDefinition[],
  data: Record<string, unknown>[]
): string {
  const escapeCsvValue = (val: unknown): string => {
    const sanitized = sanitizeCellForFormulaInjection(val ?? '')
    const str = String(sanitized)
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headerLine = columns.map((c) => escapeCsvValue(c.header)).join(',')
  const rowsLines = data.map((row) =>
    columns.map((c) => escapeCsvValue(row[c.key])).join(',')
  )

  // \uFEFF BOM forces Excel on Windows to parse UTF-8 correctly
  return `\uFEFF${[headerLine, ...rowsLines].join('\r\n')}`
}

/**
 * Template columns for Firm Batch Import
 */
export const IMPORT_TEMPLATE_COLUMNS: ColumnDefinition[] = [
  { header: 'Firm Name', key: 'firm_name', width: 30 },
  { header: 'Contact Person', key: 'contact_person', width: 22 },
  { header: 'Email', key: 'contact_email', width: 28 },
  { header: 'Phone', key: 'contact_phone', width: 18 },
  { header: 'Default Employee Email', key: 'employee_email', width: 28 },
  { header: 'Required Documents', key: 'required_documents', width: 45 },
  { header: 'Optional Documents', key: 'optional_documents', width: 40 },
]

export const IMPORT_TEMPLATE_SAMPLE_DATA = [
  {
    firm_name: 'Acme Logistics Pvt Ltd',
    contact_person: 'Rajesh Verma',
    contact_email: 'rajesh@acmelogistics.fake',
    contact_phone: '+91 98200 11223',
    employee_email: 'admin@financeflow.local',
    required_documents: 'Sales Register, Purchase Register, Bank Statement',
    optional_documents: 'Expense Vouchers',
  },
  {
    firm_name: 'Cauvery Retailers & Wholesalers',
    contact_person: 'Suresh Iyer',
    contact_email: 'suresh@cauveryretail.fake',
    contact_phone: '+91 98400 55667',
    employee_email: '',
    required_documents: 'Sales Register, GSTR-3B Summary',
    optional_documents: '',
  },
]
