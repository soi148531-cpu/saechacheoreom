'use client'

import { useState } from 'react'
import { updateMessageSentAt } from '@/lib/services/messageService'

interface MessageButtonProps {
  billingId: string
  messageSentAt: string | null
  onUpdate?: (billingId: string) => void
}

export function MessageButton({
  billingId,
  messageSentAt,
  onUpdate
}: MessageButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleSendMessage() {
    setLoading(true)
    const { error } = await updateMessageSentAt(billingId)
    setLoading(false)
    if (!error) {
      onUpdate?.(billingId)
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
