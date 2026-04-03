'use client'

import { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'

interface CompletionModalProps {
  isOpen: boolean
  onClose: () => void
  vehicle: {
    id: string
    car_name: string
    plate_number: string
    unit_price: number
  }
  customer: {
    name: string
    apartment: string
    unit_number: string | null
  }
  scheduled_date: string
  schedule_id: string
  onSuccess?: () => void
}

interface Worker {
  id: string
  name: string
  phone: string | null
}

export default function CompletionModal({
  isOpen,
  onClose,
  vehicle,
  customer,
  scheduled_date,
  schedule_id,
  onSuccess,
}: CompletionModalProps) {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [workerOption, setWorkerOption] = useState<'me' | 'other'>('me')
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null)
  const [completedAt, setCompletedAt] = useState('')
  const [hasInterior, setHasInterior] = useState(false)
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 현재 시간 초기값 설정
  useEffect(() => {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    setCompletedAt(`${hours}:${minutes}`)
  }, [])

  // 직원 목록 불러오기
  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const res = await fetch('/api/workers')
        if (!res.ok) return
        const json = await res.json()
        const data = (json.data || json) as Worker[]
        setWorkers(data)
        if (data.length > 0 && !selectedWorker) {
          setSelectedWorker(data[0].id)
        }
      } catch (err) {
        console.error('Failed to fetch workers:', err)
      }
    }

    if (isOpen) {
      fetchWorkers()
    }
  }, [isOpen, selectedWorker])

  const calculatePrice = () => {
    const basePrice = vehicle.unit_price || 0
    return hasInterior ? basePrice + 10000 : basePrice
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const finalPrice = calculatePrice()
      
      let workerId: string | null = null
      let workedBy: 'worker' | 'admin' = 'worker'

      if (workerOption === 'other' && selectedWorker) {
        workerId = selectedWorker
        workedBy = 'worker'
      } else if (workerOption === 'me') {
        // "나" 옵션은 현재 로그인 워커가 필요하지만, 미구현
        // 현재는 첫 번째 워커 기본값
        workerId = workers[0]?.id || null
        workedBy = 'worker'
      }

      const dateStr = new Date().toISOString().split('T')[0]
      const [hours, mins] = completedAt.split(':')
      const completedAtISO = `${dateStr}T${hours}:${mins}:00Z`

      const response = await fetch('/api/wash-records/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicle.id,
          schedule_id,
          wash_date: dateStr,
          price: finalPrice,
          service_type: hasInterior ? 'interior' : 'regular',
          worker_id: workerId,
          worked_by: workedBy,
          completed_at: completedAtISO,
          memo: memo.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '완료 처리 실패')
      }

      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '완료 처리 중 오류 발생')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">세차 완료 처리</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 차량/고객 정보 */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <p className="font-semibold text-gray-900 text-sm">{vehicle.car_name}</p>
            <p className="text-xs text-gray-600">{vehicle.plate_number}</p>
            <p className="text-xs text-gray-600 mt-1">
              {customer.name} {customer.unit_number ? `· ${customer.unit_number}` : ''}
            </p>
            {customer.apartment && (
              <p className="text-xs text-blue-600 mt-1">{customer.apartment}</p>
            )}
            <p className="text-xs text-gray-500 mt-2">{scheduled_date}</p>
          </div>

          {/* 당번 선택 */}
          <div className="border-t border-gray-100 pt-3">
            <label className="block text-xs font-bold text-gray-700 mb-2">
              당번 (작업자)
            </label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="me"
                  checked={workerOption === 'me'}
                  onChange={(e) => setWorkerOption(e.target.value as 'me')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">나(현재 로그인한 직원)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="other"
                  checked={workerOption === 'other'}
                  onChange={(e) => setWorkerOption(e.target.value as 'other')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">다른 직원 선택</span>
              </label>
            </div>

            {workerOption === 'other' && workers.length > 0 && (
              <select
                value={selectedWorker || ''}
                onChange={(e) => setSelectedWorker(e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">직원 선택</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.phone ? `(${w.phone})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 완료 시각 */}
          <div className="border-t border-gray-100 pt-3">
            <label className="block text-xs font-bold text-gray-700 mb-2">
              완료 시각
            </label>
            <input
              type="time"
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          {/* 실내청소 */}
          <div className="border-t border-gray-100 pt-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hasInterior}
                onChange={(e) => setHasInterior(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-semibold text-gray-700">
                실내청소 (+10,000원)
              </span>
            </label>
            {hasInterior && (
              <p className="text-xs text-blue-600 mt-1">
                금액: {vehicle.unit_price?.toLocaleString() || 0} + 10,000 = {calculatePrice().toLocaleString()}원
              </p>
            )}
          </div>

          {/* 예상 청구액 */}
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-xs text-gray-600">예상 청구액</p>
            <p className="text-lg font-bold text-blue-600">
              {calculatePrice().toLocaleString()}원
            </p>
          </div>

          {/* 메모 */}
          <div className="border-t border-gray-100 pt-3">
            <label className="block text-xs font-bold text-gray-700 mb-2">
              메모
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="특이사항 기록..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </form>

        {/* 푸터 */}
        <div className="border-t border-gray-200 p-4 flex gap-2 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (workerOption === 'other' && !selectedWorker)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>로딩...</>
            ) : (
              <>
                <Check size={16} />
                완료 처리
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
