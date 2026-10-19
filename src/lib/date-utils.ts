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

/**
 * Returns YYYY-MM-DD string representing today's date in Asia/Kolkata timezone.
 */
export function getTodayIST(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const year = parts.find((p) => p.type === 'year')?.value || '2026'
    const month = parts.find((p) => p.type === 'month')?.value || '10'
    const day = parts.find((p) => p.type === 'day')?.value || '19'
    return `${year}-${month}-${day}`
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/**
 * Returns YYYY-MM-01 string representing current month in Asia/Kolkata timezone.
 */
export function getCurrentMonthIST(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(date)
    const year = parts.find((p) => p.type === 'year')?.value || '2026'
    const month = parts.find((p) => p.type === 'month')?.value || '10'
    return `${year}-${month}-01`
  } catch {
    return `${date.toISOString().slice(0, 7)}-01`
  }
}

/**
 * Returns the statutory due date for a given period month and cycle.
 * Cycle A_11th -> 11th of the month
 * Cycle B_20th -> 20th of the month
 */
export function getCycleDueDate(periodMonth: string, cycle: 'A_11th' | 'B_20th'): string {
  const monthPrefix = periodMonth.slice(0, 7)
  const day = cycle === 'A_11th' ? '11' : '20'
  return `${monthPrefix}-${day}`
}

/**
 * Returns human-readable label for statutory cycle
 */
export function formatCycleLabel(cycle: string | null | undefined): string {
  if (cycle === 'A_11th') return 'Cycle A (11th of month)'
  if (cycle === 'B_20th') return 'Cycle B (20th of month)'
  return cycle || '—'
}

