'use client'

import React, { useState } from 'react'
import { EmailDraftModal } from './EmailDraftModal'
import {
  generateDispatchIntimationDraft,
  type DispatchIntimationDraftInput,
} from '@/lib/email-templates'

interface DispatchEmailButtonProps {
  firmName: string
  contactPerson?: string | null
  contactEmail?: string | null
  recipient: string
  courier?: string
  trackingNumber?: string | null
  sentAt?: string | null
  dispatchedDocuments: string[]
  senderName?: string | null
}

export function DispatchEmailButton({
  firmName,
  contactPerson,
  contactEmail,
  recipient,
  courier = 'Courier / Speed Post',
  trackingNumber,
  sentAt,
  dispatchedDocuments,
  senderName,
}: DispatchEmailButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  const draftInput: DispatchIntimationDraftInput = {
    firmName,
    contactPerson,
    contactEmail,
    recipient,
    courier,
    trackingNumber,
    sentAt,
    dispatchedDocuments,
    senderName,
  }

  const initialDraft = generateDispatchIntimationDraft(draftInput)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors min-h-[36px]"
        title="Draft dispatch advice email to client"
      >
        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <span>Email Dispatch Advice</span>
      </button>

      <EmailDraftModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialDraft={initialDraft}
        title={`Dispatch Advice • ${firmName}`}
        subtitle={`Pre-filled outward dispatch details for ${recipient}.`}
      />
    </>
  )
}
