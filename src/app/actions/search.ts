'use server'

import { createClient } from '@/utils/supabase/server'
import { assertAuth } from '@/utils/auth'

export interface SearchResultFirm {
  id: string
  name: string
  contact_person: string | null
  is_active: boolean
}

export interface SearchResultCase {
  case_id: string
  firm_name: string
  period_month: string
  cycle: string
  status: string
  is_overdue: boolean
}

export interface SearchResultDocument {
  case_document_id: string
  case_id: string
  firm_name: string
  document_type_name: string
  period_month: string
  cycle: string
  status: string
}

export interface GlobalSearchResults {
  firms: SearchResultFirm[]
  cases: SearchResultCase[]
  documents: SearchResultDocument[]
}

/**
 * Fast, server-side debounced search across firms, cases, and checklist documents.
 * Limited to 5 results per entity type to keep responses snappy.
 */
export async function searchGlobal(rawQuery: string): Promise<GlobalSearchResults> {
  const query = rawQuery?.trim()
  if (!query || query.length < 2) {
    return { firms: [], cases: [], documents: [] }
  }

  // Ensure caller is authenticated and active
  await assertAuth()
  const supabase = await createClient()

  const [firmsRes, casesRes, docsRes] = await Promise.all([
    supabase
      .from('firms')
      .select('id, name, contact_person, is_active')
      .ilike('name', `%${query}%`)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true })
      .limit(5),
    supabase
      .from('case_status')
      .select('case_id, firm_name, period_month, cycle, status, is_overdue')
      .ilike('firm_name', `%${query}%`)
      .order('period_month', { ascending: false })
      .limit(5),
    supabase
      .from('case_document_status')
      .select('case_document_id, case_id, firm_name, document_type_name, period_month, cycle, status')
      .ilike('document_type_name', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return {
    firms: (firmsRes.data || []) as SearchResultFirm[],
    cases: (casesRes.data || []) as SearchResultCase[],
    documents: (docsRes.data || []) as SearchResultDocument[],
  }
}
