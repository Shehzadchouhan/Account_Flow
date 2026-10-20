import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDateIST,
  formatMonthYear,
  getTodayIST,
  getCycleDueDate,
  formatCycleLabel,
} from '../../src/lib/date-utils.ts'
import {
  sanitizeCellForFormulaInjection,
  generateCsvString,
} from '../../src/lib/export-utils.ts'
import { getFriendlyErrorMessage } from '../../src/lib/error-mapper.ts'
import { formatActivityLog } from '../../src/lib/activity-utils.ts'
import {
  generateClientReminderDraft,
  generateDispatchIntimationDraft,
} from '../../src/lib/email-templates.ts'

describe('1. Date & Time Helpers (Asia/Kolkata)', () => {
  it('formats dates accurately in IST timezone', () => {
    // 2026-10-15 UTC midnight is 2026-10-15 05:30 IST
    const formatted = formatDateIST('2026-10-15T00:00:00Z')
    assert.match(formatted, /15/)
    assert.match(formatted, /Oct/)
    assert.match(formatted, /2026/)
  })

  it('formats month and year accurately', () => {
    assert.equal(formatMonthYear('2026-10-01'), 'Oct 2026')
    assert.equal(formatMonthYear('2027-01-01'), 'Jan 2027')
    assert.equal(formatMonthYear(null), '—')
  })

  it('returns valid today string in YYYY-MM-DD format', () => {
    const today = getTodayIST()
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/)
  })

  it('calculates statutory cycle due dates correctly', () => {
    assert.equal(getCycleDueDate('2026-10-01', 'A_11th'), '2026-10-11')
    assert.equal(getCycleDueDate('2026-10-01', 'B_20th'), '2026-10-20')
  })

  it('formats cycle display labels cleanly', () => {
    assert.equal(formatCycleLabel('A_11th'), 'Cycle A (11th of month)')
    assert.equal(formatCycleLabel('B_20th'), 'Cycle B (20th of month)')
  })
})

describe('2. Export & Formula Injection Sanitization', () => {
  it('neutralizes spreadsheet formula injection characters', () => {
    // Escapes leading =, +, -, @, tab, carriage return
    assert.equal(sanitizeCellForFormulaInjection('=SUM(A1:B10)'), "'=SUM(A1:B10)")
    assert.equal(sanitizeCellForFormulaInjection('+CMD|calc.exe'), "'+CMD|calc.exe")
    assert.equal(sanitizeCellForFormulaInjection('-5+2'), "'-5+2")
    assert.equal(sanitizeCellForFormulaInjection('@IMPORTXML(...)'), "'@IMPORTXML(...)")
    assert.equal(sanitizeCellForFormulaInjection('\tmaliciousTab'), "'\tmaliciousTab")
    assert.equal(sanitizeCellForFormulaInjection('\rmaliciousReturn'), "'\rmaliciousReturn")
  })

  it('preserves legitimate numbers and clean strings untouched', () => {
    assert.equal(sanitizeCellForFormulaInjection(42), 42)
    assert.equal(sanitizeCellForFormulaInjection(-42), -42)
    assert.equal(sanitizeCellForFormulaInjection(3.14159), 3.14159)
    assert.equal(sanitizeCellForFormulaInjection('Standard Firm Pvt Ltd'), 'Standard Firm Pvt Ltd')
    assert.equal(sanitizeCellForFormulaInjection(null), '')
    assert.equal(sanitizeCellForFormulaInjection(undefined), '')
  })

  it('generates valid UTF-8 CSV with byte-order mark and formula neutralization', () => {
    const columns = [
      { header: 'Firm Name', key: 'firm' },
      { header: 'Formula Payload', key: 'payload' },
    ]
    const data = [
      { firm: 'Apex Corp', payload: '=1+1' },
    ]
    const csv = generateCsvString(columns, data)

    // Verify UTF-8 BOM
    assert.ok(csv.startsWith('\uFEFF'))
    // Verify escaped formula cell
    assert.ok(csv.includes("''=1+1") || csv.includes("'=1+1"))
  })
})

describe('3. Database & System Error Mapper', () => {
  it('translates duplicate key violations (23505) into clear messages', () => {
    const err = { code: '23505', message: 'duplicate key value violates unique constraint "firms_name_lower_idx"' }
    const msg = getFriendlyErrorMessage(err)
    assert.match(msg, /already exists/i)
    assert.ok(!msg.includes('firms_name_lower_idx'))
  })

  it('translates foreign key constraints (23503) into clear messages', () => {
    const err = { code: '23503', message: 'violates foreign key constraint' }
    const msg = getFriendlyErrorMessage(err)
    assert.match(msg, /cannot be removed or updated/i)
  })

  it('translates concurrency conflicts into actionable reload advice', () => {
    const err = new Error('Concurrency conflict: record version has changed')
    const msg = getFriendlyErrorMessage(err)
    assert.match(msg, /Concurrency Conflict/i)
    assert.match(msg, /refresh the page/i)
  })

  it('strips raw SQL statements to prevent leaking schema internals', () => {
    const err = new Error('ERROR: syntax error at or near "SELECT" in table schema')
    const msg = getFriendlyErrorMessage(err)
    assert.ok(!msg.includes('syntax error'))
    assert.ok(!msg.includes('SELECT'))
    assert.match(msg, /database processing error/i)
  })
})

describe('4. Activity Log Formatter & Entity Links', () => {
  it('humanizes batch import events', () => {
    const formatted = formatActivityLog('import_firms', 'firms', null, {
      imported_count: 5,
      skipped_count: 2,
      created_doc_types: 1,
    })
    assert.equal(formatted.title, 'Batch Firm Import')
    assert.match(formatted.description, /Imported 5 firms/)
    assert.match(formatted.description, /skipped 2 problem rows/)
    assert.match(formatted.description, /created 1 new document types/)
    assert.equal(formatted.entityLink?.href, '/admin/import')
  })

  it('humanizes dispatch voiding with reason and restores link', () => {
    const formatted = formatActivityLog('void_dispatch', 'dispatches', 'disp-123', {
      case_id: 'case-456',
      void_reason: 'Incorrect courier reference number',
    })
    assert.equal(formatted.title, 'Dispatch Voided')
    assert.match(formatted.description, /Incorrect courier reference number/)
    assert.equal(formatted.entityLink?.href, '/cases/case-456')
  })

  it('humanizes report exports', () => {
    const formatted = formatActivityLog('export_pending_documents', 'report', null, {
      report: 'Pending Documents',
      row_count: 35,
    })
    assert.equal(formatted.title, 'Compliance Report Exported')
    assert.match(formatted.description, /Pending Documents/)
    assert.match(formatted.description, /35 rows/)
    assert.equal(formatted.entityLink?.href, '/reports')
  })
})

describe('5. Auto Email & Client Communication Generator', () => {
  it('generates pre-composed client reminder draft with encoded mailto and pending list', () => {
    const draft = generateClientReminderDraft({
      firmName: 'Shree Balaji Traders',
      contactPerson: 'Ramesh Patel',
      contactEmail: 'ramesh@balaji.com',
      periodMonth: '2026-10-01',
      cycle: 'A_11th',
      dueDate: '2026-10-11',
      missingDocuments: ['Bank Statements (HDFC Bank)', 'Sales Invoices / Vouchers'],
      senderName: 'Shehzad Chouhan',
      officeName: 'Apex Financial Services',
    })

    assert.equal(draft.recipient, 'ramesh@balaji.com')
    assert.match(draft.subject, /Shree Balaji Traders/)
    assert.match(draft.subject, /Oct 2026/)
    assert.match(draft.subject, /Cycle A/)

    // Body content verification
    assert.match(draft.body, /Dear Ramesh Patel/)
    assert.match(draft.body, /Apex Financial Services/)
    assert.match(draft.body, /Bank Statements \(HDFC Bank\)/)
    assert.match(draft.body, /Sales Invoices \/ Vouchers/)
    assert.match(draft.body, /Shehzad Chouhan/)

    // Mailto URL encoding
    assert.match(draft.mailtoUrl, /^mailto:ramesh%40balaji\.com\?subject=/)
    assert.match(draft.mailtoUrl, /Bank%20Statements/)

    // WhatsApp formatting
    assert.match(draft.whatsAppText, /\*Firm:\* Shree Balaji Traders/)
    assert.match(draft.whatsAppText, /\*•\* Bank Statements/)
  })

  it('handles firms without contact email gracefully', () => {
    const draft = generateClientReminderDraft({
      firmName: 'Mahaveer Textiles',
      contactPerson: null,
      contactEmail: null,
      periodMonth: '2026-10-01',
      cycle: 'B_20th',
      dueDate: '2026-10-20',
      missingDocuments: [],
    })

    assert.equal(draft.recipient, '')
    assert.match(draft.body, /Dear Mahaveer Textiles/)
    assert.match(draft.mailtoUrl, /^mailto:\?subject=/)
  })

  it('generates outward dispatch intimation draft with courier and tracking details', () => {
    const draft = generateDispatchIntimationDraft({
      firmName: 'Gupta Enterprises',
      contactPerson: 'Anil Gupta',
      contactEmail: 'anil@guptaent.com',
      recipient: 'Income Tax Assessing Officer Ward 3(1)',
      courier: 'India Post Speed Post',
      trackingNumber: 'EU123456789IN',
      sentAt: '2026-10-15T14:30:00Z',
      dispatchedDocuments: ['Section 143(1) Notice Reply', 'Audited Balance Sheet'],
      senderName: 'Shehzad Chouhan',
    })

    assert.equal(draft.recipient, 'anil@guptaent.com')
    assert.match(draft.subject, /Dispatch Advice/)
    assert.match(draft.subject, /Gupta Enterprises/)
    assert.match(draft.body, /India Post Speed Post/)
    assert.match(draft.body, /EU123456789IN/)
    assert.match(draft.body, /Income Tax Assessing Officer Ward 3\(1\)/)
    assert.match(draft.body, /Section 143\(1\) Notice Reply/)
    assert.match(draft.mailtoUrl, /EU123456789IN/)
  })
})
