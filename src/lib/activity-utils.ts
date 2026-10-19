/**
 * Utility functions for humanizing and formatting system activity logs.
 */

export interface FormattedActivity {
  title: string
  description: string
  entityLink?: {
    href: string
    label: string
  }
  badgeColor: {
    bg: string
    text: string
    border: string
  }
}

interface ActivityDetails {
  [key: string]: unknown
  firm_name?: string
  document_type_name?: string
  recipient?: string
  void_reason?: string
  reason?: string
  imported_count?: number
  skipped_count?: number
  created_doc_types?: number
  report?: string
  row_count?: number
  month?: string
  cycle?: string
  generated_count?: number
  role?: string
  full_name?: string
  email?: string
  case_id?: string
}

export function formatActivityLog(
  action: string,
  entityType: string,
  entityId: string | null,
  detailsRaw: unknown
): FormattedActivity {
  const details = (detailsRaw || {}) as ActivityDetails

  // 1. Firm Actions
  if (entityType === 'firms' || action.includes('firm')) {
    if (action === 'import_firms') {
      const imp = details.imported_count ?? 0
      const skip = details.skipped_count ?? 0
      const createdDocs = details.created_doc_types ?? 0
      return {
        title: 'Batch Firm Import',
        description: `Imported ${imp} ${imp === 1 ? 'firm' : 'firms'}${skip > 0 ? `, skipped ${skip} problem rows` : ''}${createdDocs > 0 ? `, created ${createdDocs} new document types` : ''}`,
        entityLink: { href: '/admin/import', label: 'View Importer' },
        badgeColor: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
      }
    }

    const firmName = details.firm_name || (details.name as string) || 'Client Firm'
    const link = entityId ? { href: `/firms/${entityId}`, label: `View ${firmName}` } : undefined

    if (action === 'create_firm' || action === 'firm_create') {
      return {
        title: 'Firm Registered',
        description: `Registered new client firm '${firmName}' with checklist template`,
        entityLink: link,
        badgeColor: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
      }
    }
    if (action === 'archive_firm') {
      return {
        title: 'Firm Archived',
        description: `Archived client firm '${firmName}' and excluded from active compliance metrics`,
        entityLink: link,
        badgeColor: { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
      }
    }
    if (action === 'unarchive_firm') {
      return {
        title: 'Firm Reactivated',
        description: `Reactivated client firm '${firmName}' for ongoing compliance tracking`,
        entityLink: link,
        badgeColor: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
      }
    }
    if (action === 'update_firm') {
      return {
        title: 'Firm Updated',
        description: `Updated contact information or default employee for '${firmName}'`,
        entityLink: link,
        badgeColor: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
      }
    }
  }

  // 2. Case Generation & Case Details Actions
  if (entityType === 'cases' || action.includes('case')) {
    if (action === 'generate_cases') {
      const count = details.generated_count ?? details.count ?? 0
      const month = details.month ? String(details.month) : 'period'
      const cycle = details.cycle === 'A_11th' ? 'Cycle A (11th)' : details.cycle === 'B_20th' ? 'Cycle B (20th)' : String(details.cycle || '')
      return {
        title: 'Cases Generated',
        description: `Generated ${count} monthly compliance ${count === 1 ? 'case' : 'cases'} for ${cycle} ${month}`,
        entityLink: { href: '/cases', label: 'View Cases' },
        badgeColor: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
      }
    }
    if (action === 'update_case_details') {
      const link = entityId ? { href: `/cases/${entityId}`, label: 'View Case' } : undefined
      return {
        title: 'Case Modified',
        description: 'Updated due date or assigned staff member',
        entityLink: link,
        badgeColor: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
      }
    }
  }

  // 3. Document Status Actions (Receive / Unreceive / Requirement)
  if (entityType === 'case_documents' || action.includes('document')) {
    const docName = details.document_type_name || (details.document_name as string) || 'Checklist Document'
    const caseId = (details.case_id as string) || entityId
    const link = caseId ? { href: `/cases/${caseId}`, label: 'View Case' } : undefined

    if (action === 'receive_document') {
      return {
        title: 'Document Received',
        description: `Recorded receipt of '${docName}' from client firm`,
        entityLink: link,
        badgeColor: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
      }
    }
    if (action === 'unreceive_document') {
      return {
        title: 'Receipt Reverted',
        description: `Reverted receipt of '${docName}' back to awaiting status`,
        entityLink: link,
        badgeColor: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
      }
    }
    if (action === 'bulk_receive_documents') {
      const count = Array.isArray(details.case_document_ids) ? details.case_document_ids.length : 'multiple'
      return {
        title: 'Bulk Documents Received',
        description: `Recorded receipt of ${count} documents simultaneously`,
        entityLink: link,
        badgeColor: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
      }
    }
    if (action === 'add_case_document') {
      return {
        title: 'Checklist Document Added',
        description: `Added '${docName}' to case checklist`,
        entityLink: link,
        badgeColor: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
      }
    }
    if (action === 'remove_case_document') {
      return {
        title: 'Checklist Document Removed',
        description: `Removed '${docName}' from case checklist`,
        entityLink: link,
        badgeColor: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
      }
    }
    if (action === 'set_document_required') {
      const req = details.is_required ? 'Required' : 'Optional'
      return {
        title: 'Requirement Updated',
        description: `Changed '${docName}' requirement status to ${req}`,
        entityLink: link,
        badgeColor: { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
      }
    }
    if (action === 'update_notes') {
      return {
        title: 'Document Notes Updated',
        description: `Updated operational comments on '${docName}'`,
        entityLink: link,
        badgeColor: { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
      }
    }
  }

  // 4. Dispatch Actions
  if (entityType === 'dispatches' || action.includes('dispatch')) {
    if (action === 'create_dispatch') {
      const recipient = details.recipient ? `to '${details.recipient}'` : ''
      const docCount = Array.isArray(details.case_document_ids) ? details.case_document_ids.length : ''
      const caseId = (details.case_id as string) || undefined
      return {
        title: 'Outward Dispatch Recorded',
        description: `Dispatched ${docCount ? `${docCount} documents ` : ''}${recipient}`,
        entityLink: caseId ? { href: `/cases/${caseId}`, label: 'View Case' } : { href: '/dispatches', label: 'View Dispatches' },
        badgeColor: { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
      }
    }
    if (action === 'void_dispatch') {
      const reason = details.void_reason || details.reason ? ` (Reason: ${details.void_reason || details.reason})` : ''
      const caseId = (details.case_id as string) || undefined
      return {
        title: 'Dispatch Voided',
        description: `Voided outward consignment${reason}; restored documents to pending dispatch`,
        entityLink: caseId ? { href: `/cases/${caseId}`, label: 'View Case' } : { href: '/dispatches', label: 'View Dispatches' },
        badgeColor: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
      }
    }
  }

  // 5. Report Export Actions
  if (action.startsWith('export_') || entityType === 'report') {
    const reportName = (details.report as string) || action.replace('export_', '').replace(/_/g, ' ')
    const rowCount = details.row_count !== undefined ? Number(details.row_count) : null
    return {
      title: 'Compliance Report Exported',
      description: `Exported '${reportName}' register${rowCount !== null ? ` (${rowCount} rows)` : ''}`,
      entityLink: { href: '/reports', label: 'Export Center' },
      badgeColor: { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200' },
    }
  }

  // 6. User Administration Actions
  if (entityType === 'profiles' || action.includes('user')) {
    const fullName = (details.full_name as string) || 'User'
    if (action === 'update_profile' || action === 'update_user_role') {
      const role = details.role ? ` to ${String(details.role).toUpperCase()}` : ''
      return {
        title: 'User Profile Updated',
        description: `Updated profile permissions for ${fullName}${role}`,
        entityLink: { href: '/admin/users', label: 'Manage Users' },
        badgeColor: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
      }
    }
  }

  // 7. Master Document Types Actions
  if (entityType === 'document_types') {
    const name = (details.name as string) || 'Document Type'
    return {
      title: 'Document Type Configured',
      description: `Configured master document category '${name}' in dictionary`,
      entityLink: { href: '/admin/document-types', label: 'View Catalog' },
      badgeColor: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
    }
  }

  // Default Fallback
  return {
    title: action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: `Performed ${action} on ${entityType}${entityId ? ` (${entityId.slice(0, 8)}...)` : ''}`,
    entityLink: undefined,
    badgeColor: { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' },
  }
}
