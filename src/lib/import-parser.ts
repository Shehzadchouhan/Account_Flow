import { Readable } from 'stream'
import ExcelJS from 'exceljs'

export interface ParsedRowPreview {
  rowNumber: number
  firm_name: string
  contact_person: string
  contact_email: string
  contact_phone: string
  employee_email: string
  required_documents: string[]
  optional_documents: string[]
  status:
    | 'Valid'
    | 'Missing name'
    | 'Duplicate within file'
    | 'Already exists'
    | 'Invalid email'
    | 'Unknown employee'
    | 'Unknown document type'
  reasons: string[]
  unknown_doc_types: string[]
}

export interface ImportPreviewResult {
  totalRows: number
  validCount: number
  issueCount: number
  unknownDocTypes: string[]
  rows: ParsedRowPreview[]
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Extracts raw textual representation of a cell without evaluating formulas.
 */
function getCellString(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) {
    return ''
  }
  if (typeof cell.value === 'object') {
    // If ExcelJS parsed a formula or rich text object, read text or result without executing
    const obj = cell.value as unknown as Record<string, unknown>
    if ('richText' in obj && Array.isArray(obj.richText)) {
      return (obj.richText as { text: string }[]).map((t) => t.text).join('')
    }
    if ('result' in obj && obj.result !== undefined && obj.result !== null) {
      return String(obj.result).trim()
    }
    if ('text' in obj && typeof obj.text === 'string') {
      return obj.text.trim()
    }
    return ''
  }
  return String(cell.value).trim()
}

/**
 * Parses an uploaded .xlsx or .csv file buffer on the server.
 * Enforces:
 * - Max file size: 5 MB
 * - Max rows: 2000
 * - Never evaluates formulas
 * - Categorizes status for every single row
 */
export async function parseImportFile(
  buffer: Buffer,
  fileName: string,
  existingFirmsLower: Set<string>,
  activeEmployeesEmailMap: Map<string, string>, // lower(email) -> profile_id
  knownDocTypesLower: Set<string> // lower(name) -> boolean
): Promise<ImportPreviewResult> {
  // 1. File Size Verification
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('File exceeds the maximum allowable size limit of 5 MB.')
  }

  // 2. Format Verification
  const lowerName = fileName.toLowerCase()
  const isXlsx = lowerName.endsWith('.xlsx')
  const isCsv = lowerName.endsWith('.csv')

  if (!isXlsx && !isCsv) {
    throw new Error('Unsupported file format. Only .xlsx and .csv files are supported.')
  }

  // 3. Parse Workbook
  const workbook = new ExcelJS.Workbook()
  if (isXlsx) {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  } else {
    const stream = Readable.from(buffer)
    await workbook.csv.read(stream)
  }

  const worksheet = workbook.worksheets[0]
  if (!worksheet || worksheet.rowCount <= 1) {
    return {
      totalRows: 0,
      validCount: 0,
      issueCount: 0,
      unknownDocTypes: [],
      rows: [],
    }
  }

  // 4. Map Column Headers from Row 1
  const headerRow = worksheet.getRow(1)
  const colMap: Record<string, number> = {}

  headerRow.eachCell((cell, colNumber) => {
    const headerText = getCellString(cell).toLowerCase().replace(/[^a-z0-9]/g, '')
    if (headerText.includes('firmname')) colMap.firm_name = colNumber
    else if (headerText.includes('contactperson')) colMap.contact_person = colNumber
    else if (headerText.includes('defaultemployee') || headerText.includes('employeeemail')) colMap.employee_email = colNumber
    else if (headerText.includes('email')) colMap.contact_email = colNumber
    else if (headerText.includes('phone')) colMap.contact_phone = colNumber
    else if (headerText.includes('requireddocument')) colMap.required_documents = colNumber
    else if (headerText.includes('optionaldocument')) colMap.optional_documents = colNumber
  })

  // Fallback positional indexing if headers were slightly different
  const firmCol = colMap.firm_name || 1
  const contactPersonCol = colMap.contact_person || 2
  const contactEmailCol = colMap.contact_email || 3
  const contactPhoneCol = colMap.contact_phone || 4
  const employeeEmailCol = colMap.employee_email || 5
  const reqDocsCol = colMap.required_documents || 6
  const optDocsCol = colMap.optional_documents || 7

  const totalDataRows = worksheet.rowCount - 1
  if (totalDataRows > 2000) {
    throw new Error(`File exceeds maximum limit of 2,000 rows (found ${totalDataRows} rows).`)
  }

  const seenInFileNames = new Set<string>()
  const parsedRows: ParsedRowPreview[] = []
  const allUnknownDocTypesSet = new Set<string>()

  // 5. Row-by-Row Processing
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r)

    // Check if entire row is empty
    let hasAnyData = false
    row.eachCell(() => {
      hasAnyData = true
    })
    if (!hasAnyData) {
      continue
    }

    const firm_name = getCellString(row.getCell(firmCol))
    const contact_person = getCellString(row.getCell(contactPersonCol))
    const contact_email = getCellString(row.getCell(contactEmailCol))
    const contact_phone = getCellString(row.getCell(contactPhoneCol))
    const employee_email = getCellString(row.getCell(employeeEmailCol))
    const reqDocsRaw = getCellString(row.getCell(reqDocsCol))
    const optDocsRaw = getCellString(row.getCell(optDocsCol))

    const required_documents = reqDocsRaw
      ? reqDocsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : []
    const optional_documents = optDocsRaw
      ? optDocsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    const reasons: string[] = []
    const unknown_doc_types: string[] = []

    // Check unknown document types
    for (const doc of [...required_documents, ...optional_documents]) {
      if (!knownDocTypesLower.has(doc.toLowerCase())) {
        unknown_doc_types.push(doc)
        allUnknownDocTypesSet.add(doc)
      }
    }

    // Determine row status (ordered by priority)
    let status: ParsedRowPreview['status'] = 'Valid'

    if (!firm_name) {
      status = 'Missing name'
      reasons.push('Firm name is required but was blank.')
    } else {
      const lowerFirm = firm_name.toLowerCase()
      if (seenInFileNames.has(lowerFirm)) {
        status = 'Duplicate within file'
        reasons.push(`Duplicate firm name "${firm_name}" found multiple times in this uploaded file.`)
      } else if (existingFirmsLower.has(lowerFirm)) {
        status = 'Already exists'
        reasons.push(`Firm "${firm_name}" is already registered in FinanceFlow.`)
      }
      seenInFileNames.add(lowerFirm)
    }

    // Email validation
    if (contact_email && !EMAIL_REGEX.test(contact_email)) {
      if (status === 'Valid') status = 'Invalid email'
      reasons.push(`Contact email "${contact_email}" has an invalid format.`)
    }

    // Employee validation
    if (employee_email) {
      if (!EMAIL_REGEX.test(employee_email)) {
        if (status === 'Valid') status = 'Invalid email'
        reasons.push(`Employee email "${employee_email}" has an invalid format.`)
      } else if (!activeEmployeesEmailMap.has(employee_email.toLowerCase())) {
        if (status === 'Valid') status = 'Unknown employee'
        reasons.push(`Default employee "${employee_email}" does not match any active staff profile in FinanceFlow.`)
      }
    }

    // Unknown document types
    if (unknown_doc_types.length > 0) {
      if (status === 'Valid') status = 'Unknown document type'
      reasons.push(`Unknown document types: ${unknown_doc_types.join(', ')}`)
    }

    parsedRows.push({
      rowNumber: r,
      firm_name,
      contact_person,
      contact_email,
      contact_phone,
      employee_email,
      required_documents,
      optional_documents,
      status,
      reasons,
      unknown_doc_types,
    })
  }

  const validCount = parsedRows.filter((r) => r.status === 'Valid').length
  const issueCount = parsedRows.length - validCount

  return {
    totalRows: parsedRows.length,
    validCount,
    issueCount,
    unknownDocTypes: Array.from(allUnknownDocTypesSet).sort(),
    rows: parsedRows,
  }
}
