/**
 * Date and time formatting helpers specifically tailored for FinanceFlow (Asia/Kolkata timezone).
 */

export function formatDateTimeIST(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  } catch {
    return dateStr
  }
}

export function formatDateIST(dateStr: string | null | undefined): string {
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

export function formatMonthYear(monthStr: string | null | undefined): string {
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

/**
 * Returns YYYY-MM-DDTHH:mm string in Asia/Kolkata for datetime-local input fields
 */
export function toInputDateTimeLocalIST(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(date)
    const map: Record<string, string> = {}
    parts.forEach((p) => {
      map[p.type] = p.value
    })
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
  } catch {
    return date.toISOString().slice(0, 16)
  }
}
