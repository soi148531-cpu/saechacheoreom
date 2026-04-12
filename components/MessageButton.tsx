'use client'

import { useState } from 'react'
import { updateMessageSentAt } from '@/lib/services/messageService'

interface MessageButtonProps {
  billingId: string | null
  messageSentAt: string | null
  onUpdate?: (billingId: string) => void
  onEnsureBilling?: () => Promise<string | undefined>
}

export function MessageButton({
  billingId,
  messageSentAt,
  onUpdate,
  onEnsureBilling
}: MessageButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleSendMessage() {
    setLoading(true)
    let id = billingId
    if (!id && onEnsureBilling) {
      id = (await onEnsureBilling()) ?? null
    }
    if (!id) {
      setLoading(false)
      return
    }
    const { error } = await updateMessageSentAt(id)
    setLoading(false)
    if (!error) {
      onUpdate?.(id)
    }
  }

  return (
    <button
      onClick={handleSendMessage}
      disabled={loading}
      className={`px-3 py-1.5 text-sm font-semibold rounded transition-colors ${
        loading
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}
    >
      {loading ? '처리 중...' : messageSentAt ? '재발송' : '카톡 발송'}
    </button>
  )
}
