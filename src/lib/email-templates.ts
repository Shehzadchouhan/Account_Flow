export interface ClientReminderDraftInput {
  firmName: string
  contactPerson?: string | null
  contactEmail?: string | null
  periodMonth: string
  cycle: string
  dueDate: string
  missingDocuments: string[]
  senderName?: string | null
  officeName?: string
}

export interface DispatchIntimationDraftInput {
  firmName: string
  contactPerson?: string | null
  contactEmail?: string | null
  recipient: string
  courier: string
  trackingNumber?: string | null
  sentAt?: string | null
  dispatchedDocuments?: string[]
  senderName?: string | null
  officeName?: string
}

export interface GeneratedEmailDraft {
  recipient: string
  subject: string
  body: string
  mailtoUrl: string
  whatsAppText: string
}

function formatMonthYearHelper(monthStr: string | null | undefined): string {
  if (!monthStr) return '—'
  try {
    const d = new Date(`${monthStr.slice(0, 7)}-01T00:00:00Z`)
    if (isNaN(d.getTime())) return monthStr
    return d.toLocaleString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return monthStr
  }
}

function formatDateISTHelper(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d)
  } catch {
    return dateStr
  }
}

function formatCycleHelper(cycle: string): string {
  if (cycle === 'A_11th') return 'Cycle A (11th of month)'
  if (cycle === 'B_20th') return 'Cycle B (20th of month)'
  return cycle
}

/**
 * Generates a pre-composed reminder email and WhatsApp message draft
 * reminding a client firm to submit their pending compliance documents.
 */
export function generateClientReminderDraft(
  input: ClientReminderDraftInput
): GeneratedEmailDraft {
  const recipient = (input.contactEmail || '').trim()
  const greetingName = input.contactPerson?.trim() || input.firmName.trim()
  const monthStr = formatMonthYearHelper(input.periodMonth)
  const cycleStr = formatCycleHelper(input.cycle)
  const dueDateStr = formatDateISTHelper(input.dueDate)
  const officeTitle = input.officeName || 'Finance & Accounts Office'
  const senderSignature = input.senderName?.trim() || 'Compliance Team'

  const subject = `[Action Required] Pending Compliance Documents for ${monthStr} (${cycleStr}) - ${input.firmName}`

  const docList =
    input.missingDocuments && input.missingDocuments.length > 0
      ? input.missingDocuments.map((doc) => `  • ${doc}`).join('\n')
      : '  • Monthly compliance records & physical vouchers'

  const body = `Dear ${greetingName},

Greetings from our ${officeTitle}.

This is a gentle reminder regarding the monthly compliance documents required for ${input.firmName} for ${monthStr} (${cycleStr}).

Target Statutory Due Date: ${dueDateStr}

The following documents/records are currently pending from your end:
${docList}

Kindly arrange to share the above documents or digital scans at your earliest convenience to avoid any compliance delay or statutory late fees.

If you have already sent or submitted these records, please reply with the courier/acknowledgment details so we can update your case register.

Thank you,
${senderSignature}
${officeTitle}`

  // WhatsApp formatted text with bold tags (*text*)
  const waDocList =
    input.missingDocuments && input.missingDocuments.length > 0
      ? input.missingDocuments.map((doc) => `  *•* ${doc}`).join('\n')
      : '  *•* Monthly compliance records & vouchers'

  const whatsAppText = `*Reminder: Pending Compliance Documents*
*Firm:* ${input.firmName}
*Period:* ${monthStr} (${cycleStr})
*Statutory Due Date:* ${dueDateStr}

Dear ${greetingName},
Please arrange to provide the following pending documents at the earliest:
${waDocList}

Kindly revert with soft copies or dispatch details.
Thank you,
*${senderSignature}* (${officeTitle})`

  const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`

  return {
    recipient,
    subject,
    body,
    mailtoUrl,
    whatsAppText,
  }
}

/**
 * Generates an outward dispatch intimation email draft informing
 * the client firm or department that physical or digital parcels have been dispatched.
 */
export function generateDispatchIntimationDraft(
  input: DispatchIntimationDraftInput
): GeneratedEmailDraft {
  const recipient = (input.contactEmail || '').trim()
  const greetingName = input.contactPerson?.trim() || input.firmName.trim()
  const dispatchDateStr = input.sentAt ? formatDateISTHelper(input.sentAt) : formatDateISTHelper(new Date().toISOString())
  const officeTitle = input.officeName || 'Finance & Accounts Office'
  const senderSignature = input.senderName?.trim() || 'Dispatch & Accounts Team'
  const trackingRef = input.trackingNumber?.trim() || 'Hand Delivery / Local Messenger'

  const subject = `[Dispatch Advice] Outward Consignment Dispatched - ${input.firmName} (${input.courier})`

  const docList =
    input.dispatchedDocuments && input.dispatchedDocuments.length > 0
      ? input.dispatchedDocuments.map((doc) => `  • ${doc}`).join('\n')
      : '  • Completed statutory docket / assessment submissions'

  const body = `Dear ${greetingName},

Please be informed that an outward consignment has been dispatched on behalf of ${input.firmName}.

Consignment Summary:
  • Courier / Delivery Mode: ${input.courier}
  • Tracking / Consignment No.: ${trackingRef}
  • Date of Dispatch: ${dispatchDateStr}
  • Addressed / Submitted To: ${input.recipient}

Dispatched Contents:
${docList}

You may track this consignment using the reference number above. A copy of the postal/delivery receipt has been recorded in our office register.

Thank you,
${senderSignature}
${officeTitle}`

  const whatsAppText = `*Outward Dispatch Intimation*
*Firm:* ${input.firmName}
*Courier:* ${input.courier}
*Tracking No:* ${trackingRef}
*Date:* ${dispatchDateStr}
*Addressed To:* ${input.recipient}

The outward consignment for ${input.firmName} has been handed over for dispatch.
Thank you,
*${senderSignature}* (${officeTitle})`

  const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`

  return {
    recipient,
    subject,
    body,
    mailtoUrl,
    whatsAppText,
  }
}
