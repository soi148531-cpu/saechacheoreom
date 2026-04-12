'use client'

import { useState, useEffect } from 'react'
import { getMessageTemplate, updateMessageTemplate } from '@/lib/services/messageService'
import type { MessageTemplate } from '@/types'

export function MessageSettingsPanel() {
  const [template, setTemplate] = useState<MessageTemplate | null>(null)
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadTemplate()
  }, [])

  async function loadTemplate() {
    const data = await getMessageTemplate('billing_notification')
    if (data) {
      setTemplate(data)
      setBody(data.message_body)
    }
  }

  async function handleSave() {
    setLoading(true)
    const { error } = await updateMessageTemplate('billing_notification', body)
    setLoading(false)

    if (!error) {
      setSaved(true)
      setEditing(false)
      loadTemplate()
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 max-w-2xl">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">카톡 메시지 템플릿</h3>

      {/* 사용 가능한 변수 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-xs font-semibold text-blue-900 mb-1">사용 가능한 변수:</p>
        <p className="text-xs text-blue-800">
          {'{customer_name}'} (고객명) · {'{car_name}'} (차량명) · {'{amount}'} (금액) ·
          {'{unit_number}'} (호수) · {'{month}'} (월)
        </p>
      </div>

      {/* 템플릿 표시/수정 */}
      {editing ? (
        <div className="space-y-3">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="메시지 템플릿을 입력하세요"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setEditing(false)
                setBody(template?.message_body || '')
              }}
              className="px-3 py-1.5 text-sm font-semibold bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 min-h-20">
            <p className="text-sm text-gray-800">{body}</p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-sm font-semibold bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            수정
          </button>
        </div>
      )}

      {saved && (
        <div className="mt-3 p-2 bg-green-100 text-green-700 text-sm rounded">
          ✅ 메시지 템플릿이 저장되었습니다
        </div>
      )}
    </div>
  )
}
