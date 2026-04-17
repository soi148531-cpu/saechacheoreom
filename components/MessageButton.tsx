'use client'

import { useState } from 'react'
import { updateMessageSentAt } from '@/lib/services/messageService'
import { MessageSquare, Check, RotateCcw } from 'lucide-react'

interface MessageButtonProps {
  billingId: string | null
  messageSentAt: string | null
  onUpdate?: (billingId: string) => void
  onEnsureBilling?: () => Promise<string | undefined>
}

function formatSentAt(iso: string) {
  const d = new Date(iso)
  const M = d.getMonth() + 1
  const D = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${M}/${D} ${h}:${m}`
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
      alert('청구 정보 생성에 실패했습니다.')
      setLoading(false)
      return
    }
    const { error } = await updateMessageSentAt(id)
    setLoading(false)
    if (error) {
      alert('발송 처리 실패: ' + error.message)
      return
    }
    onUpdate?.(id)
  }

  if (messageSentAt) {
    return (
      <div className="flex items-center gap-1">
        {/* 발송 내역 */}
        <div className="flex items-center gap-1 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded font-medium">
          <Check size={11} />
          발송 {formatSentAt(messageSentAt)}
        </div>
        {/* 재발송 버튼 */}
        <button
          onClick={handleSendMessage}
          disabled={loading}
          className="flex items-center gap-0.5 text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          title="재발송"
        >
          <RotateCcw size={11} />
          {loading ? '...' : '재발송'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleSendMessage}
      disabled={loading}
      className={`flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded transition-colors ${
        loading
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}
    >
      <MessageSquare size={13} />
      {loading ? '처리 중...' : '카톡 발송'}
    </button>
  )
}
