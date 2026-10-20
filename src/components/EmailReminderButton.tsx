'use client'

import React, { useState } from 'react'
import { EmailDraftModal } from './EmailDraftModal'
import {
  generateClientReminderDraft,
  type ClientReminderDraftInput,
} from '@/lib/email-templates'

interface EmailReminderButtonProps {
  firmName: string
  contactPerson?: string | null
  contactEmail?: string | null
  periodMonth: string
  cycle: string
  dueDate: string
  missingDocuments: string[]
  senderName?: string | null
  variant?: 'primary' | 'secondary' | 'compact'
  buttonLabel?: string
}

export function EmailReminderButton({
  firmName,
  contactPerson,
  contactEmail,
  periodMonth,
  cycle,
  dueDate,
  missingDocuments,
  senderName,
  variant = 'primary',
  buttonLabel = 'Draft Client Email',
}: EmailReminderButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  const draftInput: ClientReminderDraftInput = {
    firmName,
    contactPerson,
    contactEmail,
    periodMonth,
    cycle,
    dueDate,
    missingDocuments,
    senderName,
  }

  const initialDraft = generateClientReminderDraft(draftInput)

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title={`Draft reminder email to ${firmName}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 rounded-md border border-blue-200 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <span>Email</span>
        </button>
      ) : variant === 'secondary' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs min-h-[38px]"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <span>{buttonLabel}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors shadow-2xs min-h-[38px]"
        >
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <span>{buttonLabel}</span>
        </button>
      )}

      <EmailDraftModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialDraft={initialDraft}
        title={`Draft Reminder Email • ${firmName}`}
        subtitle={`Pre-filled email with missing checklist items for ${cycle} (${periodMonth}).`}
      />
    </>
  )
}
