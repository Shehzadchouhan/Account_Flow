'use client'

import React, { useState, useEffect } from 'react'
import type { GeneratedEmailDraft } from '@/lib/email-templates'

interface EmailDraftModalProps {
  isOpen: boolean
  onClose: () => void
  initialDraft: GeneratedEmailDraft
  title?: string
  subtitle?: string
}

export function EmailDraftModal({
  isOpen,
  onClose,
  initialDraft,
  title = 'Compose Client Email',
  subtitle = 'Review, customize, and launch in your email client or copy to clipboard.',
}: EmailDraftModalProps) {
  const [recipient, setRecipient] = useState(initialDraft.recipient)
  const [subject, setSubject] = useState(initialDraft.subject)
  const [body, setBody] = useState(initialDraft.body)
  const [copiedType, setCopiedType] = useState<'email' | 'whatsapp' | null>(null)

  // Sync draft when initialDraft changes
  useEffect(() => {
    if (isOpen) {
      setRecipient(initialDraft.recipient)
      setSubject(initialDraft.subject)
      setBody(initialDraft.body)
      setCopiedType(null)
    }
  }, [isOpen, initialDraft])

  // ESC key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const mailtoUrl = `mailto:${encodeURIComponent(recipient.trim())}?subject=${encodeURIComponent(
    subject.trim()
  )}&body=${encodeURIComponent(body.trim())}`

  const handleLaunchEmailClient = () => {
    window.location.href = mailtoUrl
  }

  const handleCopyEmail = async () => {
    const textToCopy = `To: ${recipient}\nSubject: ${subject}\n\n${body}`
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopiedType('email')
      setTimeout(() => setCopiedType(null), 2500)
    } catch {
      // Fallback
    }
  }

  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(initialDraft.whatsAppText)
      setCopiedType('whatsapp')
      setTimeout(() => setCopiedType(null), 2500)
    } catch {
      // Fallback
    }
  }

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(initialDraft.whatsAppText)
    window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-draft-modal-title"
    >
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h2 id="email-draft-modal-title" className="text-lg font-bold text-slate-900">
                {title}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body / Form Controls */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Email missing alert if no email on file */}
          {!recipient && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-xs">
                <span className="font-semibold block">No Contact Email Registered</span>
                This firm has no contact email saved. You can enter an email address below, or copy the draft for WhatsApp.
              </div>
            </div>
          )}

          {/* Recipient Input */}
          <div>
            <label htmlFor="email-recipient" className="block text-xs font-semibold text-slate-700 mb-1">
              Recipient Email (To)
            </label>
            <input
              id="email-recipient"
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. accounts@clientfirm.com"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            />
          </div>

          {/* Subject Line */}
          <div>
            <label htmlFor="email-subject" className="block text-xs font-semibold text-slate-700 mb-1">
              Subject Line
            </label>
            <input
              id="email-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            />
          </div>

          {/* Body Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="email-body" className="block text-xs font-semibold text-slate-700">
                Message Content (Editable)
              </label>
              <span className="text-2xs text-slate-400">Pre-filled with pending items & deadline</span>
            </div>
            <textarea
              id="email-body"
              rows={9}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono text-slate-800 bg-slate-50 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white leading-relaxed"
            />
          </div>
        </div>

        {/* Modal Footer / Action Bar */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Alternative Quick Channels (Copy / WhatsApp) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyEmail}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs min-h-[38px]"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>{copiedType === 'email' ? 'Copied to Clipboard! ✓' : 'Copy Email Text'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs min-h-[38px]"
              title="Copy formatted text for WhatsApp Web"
            >
              <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
              </svg>
              <span>{copiedType === 'whatsapp' ? 'WhatsApp Text Copied! ✓' : 'Copy for WhatsApp'}</span>
            </button>
          </div>

          {/* Main Call to Action: Launch mailto */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors min-h-[38px]"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleLaunchEmailClient}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm min-h-[38px]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              <span>Open in Mail App / Outlook &rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
