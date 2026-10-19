/**
 * TypeScript Database Definitions for FinanceFlow (Phase 2)
 * Represents the PostgreSQL schema, constraints, and calculated status views.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'staff'
export type CaseCycle = 'A_11th' | 'B_20th'
export type CaseDocumentStatusType =
  | 'Awaiting Receipt'
  | 'Received - Not Dispatched'
  | 'Dispatched'

export type CaseStatusType =
  | 'No Required Documents'
  | 'Awaiting Documents'
  | 'Pending Dispatch'
  | 'Completed'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string | null
          role: UserRole
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email?: string | null
          role?: UserRole
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string | null
          role?: UserRole
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      firms: {
        Row: {
          id: string
          name: string
          contact_person: string | null
          contact_email: string | null
          contact_phone: string | null
          default_employee: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          contact_person?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          default_employee?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          contact_person?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          default_employee?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      document_types: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      firm_template_items: {
        Row: {
          id: string
          firm_id: string
          document_type_id: string
          is_required: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          firm_id: string
          document_type_id: string
          is_required?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          firm_id?: string
          document_type_id?: string
          is_required?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      cases: {
        Row: {
          id: string
          firm_id: string
          period_month: string
          cycle: CaseCycle
          due_date: string
          assigned_to: string | null
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          firm_id: string
          period_month: string
          cycle: CaseCycle
          due_date: string
          assigned_to?: string | null
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          firm_id?: string
          period_month?: string
          cycle?: CaseCycle
          due_date?: string
          assigned_to?: string | null
          version?: number
          created_at?: string
          updated_at?: string
        }
      }
      case_documents: {
        Row: {
          id: string
          case_id: string
          document_type_id: string
          is_required: boolean
          received_at: string | null
          received_by: string | null
          notes: string | null
          removed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          case_id: string
          document_type_id: string
          is_required?: boolean
          received_at?: string | null
          received_by?: string | null
          notes?: string | null
          removed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          document_type_id?: string
          is_required?: boolean
          received_at?: string | null
          received_by?: string | null
          notes?: string | null
          removed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      dispatches: {
        Row: {
          id: string
          case_id: string
          recipient: string
          sent_at: string
          recorded_by: string
          email_reference: string | null
          idempotency_key: string | null
          voided_at: string | null
          voided_by: string | null
          void_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          case_id: string
          recipient: string
          sent_at?: string
          recorded_by: string
          email_reference?: string | null
          idempotency_key?: string | null
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          recipient?: string
          sent_at?: string
          recorded_by?: string
          email_reference?: string | null
          idempotency_key?: string | null
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      dispatch_items: {
        Row: {
          id: string
          dispatch_id: string
          case_document_id: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dispatch_id: string
          case_document_id: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dispatch_id?: string
          case_document_id?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          details?: Json
          created_at?: string
        }
      }
    }
    Views: {
      case_document_status: {
        Row: {
          case_document_id: string
          case_id: string
          firm_id: string
          firm_name: string
          firm_is_active: boolean
          period_month: string
          cycle: CaseCycle
          due_date: string
          assigned_to: string | null
          assigned_to_name: string | null
          document_type_id: string
          document_type_name: string
          is_required: boolean
          received_at: string | null
          received_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
          status: CaseDocumentStatusType
          is_overdue: boolean
        }
      }
      case_status: {
        Row: {
          case_id: string
          firm_id: string
          firm_name: string
          firm_is_active: boolean
          period_month: string
          cycle: CaseCycle
          due_date: string
          assigned_to: string | null
          version: number
          created_at: string
          updated_at: string
          required_count: number
          received_count: number
          dispatched_count: number
          missing_count: number
          undispatched_count: number
          status: CaseStatusType
          is_overdue: boolean
        }
      }
    }
    Functions: {
      is_active_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      void_dispatch: {
        Args: {
          p_dispatch_id: string
          p_reason: string
        }
        Returns: void
      }
      create_dispatch: {
        Args: {
          p_case_id: string
          p_recipient: string
          p_case_document_ids: string[]
          p_sent_at?: string
          p_email_reference?: string | null
          p_idempotency_key?: string | null
        }
        Returns: Json
      }
      get_distinct_recipients: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      generate_cases: {
        Args: {
          p_month: string
          p_cycle: string
          p_due_date: string
          p_dry_run?: boolean
        }
        Returns: Json
      }
      receive_document: {
        Args: {
          p_case_document_id: string
        }
        Returns: Json
      }
      unreceive_document: {
        Args: {
          p_case_document_id: string
        }
        Returns: Json
      }
      bulk_receive_documents: {
        Args: {
          p_case_id: string
          p_case_document_ids: string[]
        }
        Returns: Json
      }
      add_case_document: {
        Args: {
          p_case_id: string
          p_document_type_id: string
          p_is_required: boolean
        }
        Returns: string
      }
      remove_case_document: {
        Args: {
          p_case_document_id: string
        }
        Returns: Json
      }
      set_document_required: {
        Args: {
          p_case_document_id: string
          p_is_required: boolean
        }
        Returns: Json
      }
      update_case_document_notes: {
        Args: {
          p_case_document_id: string
          p_notes: string
        }
        Returns: Json
      }
      update_case_details: {
        Args: {
          p_case_id: string
          p_due_date: string
          p_assigned_to: string | null
          p_version: number
        }
        Returns: Json
      }
      import_firms_batch: {
        Args: {
          p_rows: Json
          p_create_missing_doc_types?: boolean
        }
        Returns: Json
      }
      log_export_activity: {
        Args: {
          p_report_name: string
          p_filters: Json
          p_row_count: number
        }
        Returns: boolean
      }
    }
  }
}
