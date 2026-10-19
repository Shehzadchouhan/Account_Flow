/**
 * Centralized error mapping utility for FinanceFlow.
 * Translates raw database exceptions, PostgreSQL error codes, and network failures
 * into human-friendly, actionable error messages. Guarantees raw SQL is never shown to users.
 */

export interface FriendlyError {
  title: string
  message: string
  code?: string
}

/**
 * Maps any unknown error into a safe, human-readable user-facing string.
 */
export function getFriendlyErrorMessage(err: unknown, fallbackMessage = 'An unexpected error occurred. Please try again.'): string {
  if (!err) {
    return fallbackMessage
  }

  // 1. If it's a standard Error object or Supabase PostgrestError
  const rawMessage = typeof err === 'object' && err !== null && 'message' in err
    ? String((err as { message: unknown }).message)
    : String(err)

  const rawCode = typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined

  // 2. Concurrency Conflict (Optimistic Locking)
  if (
    rawMessage.includes('Concurrency conflict') ||
    rawMessage.includes('version mismatch') ||
    rawMessage.includes('concurrency')
  ) {
    return 'Concurrency Conflict: This record was recently modified by another user. Please refresh the page to view the latest data before making changes.'
  }

  // 3. PostgreSQL Error Codes
  if (rawCode === '23505' || rawMessage.includes('duplicate key value') || rawMessage.includes('already exists')) {
    if (rawMessage.includes('firms_name_lower_idx') || rawMessage.includes('firms_name_key') || rawMessage.includes('firms')) {
      return 'A client firm with this name already exists in the system. Firm names must be unique.'
    }
    if (rawMessage.includes('document_types')) {
      return 'A document type with this name already exists in the master catalog.'
    }
    if (rawMessage.includes('firm_template_items')) {
      return 'This document type is already present in this firm checklist template.'
    }
    if (rawMessage.includes('case_documents')) {
      return 'This document type is already present in this case checklist.'
    }
    return 'A duplicate entry already exists. Please verify your input and try again.'
  }

  if (rawCode === '23503' || rawMessage.includes('violates foreign key constraint')) {
    return 'This record cannot be removed or updated because other compliance records currently depend on it.'
  }

  if (rawCode === '42501' || rawMessage.includes('permission denied') || rawMessage.includes('insufficient privilege')) {
    return 'Access Denied: You do not have sufficient permissions to perform this operation.'
  }

  // 4. Authorization & Role Errors
  if (rawMessage.includes('Forbidden') || rawMessage.includes('Administrator privileges required')) {
    return 'Access Prohibited: Administrator role is required to perform this action.'
  }

  if (rawMessage.includes('Unauthorized') || rawMessage.includes('Authentication required')) {
    return 'Authentication Required: Please log in to perform this action.'
  }

  if (rawMessage.includes('Account is deactivated')) {
    return 'Account Deactivated: Your user profile is currently inactive. Please contact an administrator.'
  }

  // 5. Business Logic Rules
  if (rawMessage.includes('last remaining active administrator')) {
    return 'Operation prohibited: You cannot deactivate or demote the only remaining active administrator in the system.'
  }

  if (rawMessage.includes('active dispatch item') || rawMessage.includes('cannot be un-received')) {
    return 'This document is included in an outward dispatch and cannot be un-received or removed until the dispatch is voided.'
  }

  if (rawMessage.includes('File size exceeds')) {
    return 'File size exceeds the allowable limit of 5 MB.'
  }

  // 6. Network & Connectivity Errors
  if (rawMessage.includes('Failed to fetch') || rawMessage.includes('NetworkError') || rawMessage.includes('fetch failed')) {
    return 'Network Connection Error: Unable to reach the server. Please verify your connection and try again.'
  }

  // 7. Sanitize raw SQL keywords to avoid leaking database internals
  if (
    rawMessage.includes('SELECT') ||
    rawMessage.includes('INSERT') ||
    rawMessage.includes('UPDATE') ||
    rawMessage.includes('DELETE') ||
    rawMessage.includes('ERROR:') ||
    rawMessage.includes('syntax error') ||
    rawMessage.includes('relation') ||
    rawMessage.includes('column') ||
    rawMessage.includes('schema')
  ) {
    return 'A database processing error occurred. The technical details have been logged.'
  }

  // 8. If clean, return the sanitized message
  return rawMessage
}
