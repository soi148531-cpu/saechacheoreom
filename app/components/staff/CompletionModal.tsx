'use client'

import { useState, useEffect } from 'react'

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
    unit_number: string
  }
  scheduled_date: string
  schedule_id: string
  onSuccess?: () => void
}

interface Worker {
  id: string
  name: string
  phone: string | null
  status: string
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
  const [assignedTo, setAssignedTo] = useState<'me' | 'other' | 'admin'>('me')
  const [selectedWorker, setSelectedWorker] = useState<string>('')
  const [completedTime, setCompletedTime] = useState<string>(
    new Date().toTimeString().slice(0, 5)
  )
  const [hasInterior, setHasInterior] = useState(false)
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 직원 목록 불러오기
  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const res = await fetch('/api/workers')
        const json = await res.json()
        const data = json.data || []
        setWorkers(data)
        if (data.length > 0) {
          setSelectedWorker(data[0].id)
        }
      } catch (err) {
        console.error('Failed to fetch workers:', err)
      }
    }

    if (isOpen) {
      fetchWorkers()
    }
  }, [isOpen])

  // 가격 계산
  const calculatePrice = () => {
    const basePrice = vehicle.unit_price
    return hasInterior ? basePrice + 10000 : basePrice
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const finalPrice = calculatePrice()
      
      let worker_id: string | null = null
      let worked_by: 'worker' | 'admin'

      if (assignedTo === 'admin') {
        worked_by = 'admin'
      } else if (assignedTo === 'me') {
        // "나"는 실제로는 로그인된 직원이 되어야 하는데,
        // 현재는 직원 선택과 같음
        worker_id = selectedWorker
        worked_by = 'worker'
      } else {
        worker_id = selectedWorker
        worked_by = 'worker'
      }

      const response = await fetch('/api/wash-records/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicle.id,
          schedule_id,
          wash_date: scheduled_date,
          price: finalPrice,
          service_type: hasInterior ? 'interior' : 'regular',
          worker_id,
          worked_by,
          completed_at: new Date().toISOString(),
          memo,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '완료 처리 실패')
      }

      // 성공 콜백
      if (onSuccess) {
        onSuccess()
      }

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-lg font-bold">세차 완료 처리</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 차량 정보 */}
          <div className="pb-4 border-b">
            <p className="font-semibold">{vehicle.car_name} {vehicle.plate_number}</p>
            <p className="text-sm text-gray-600">
              {customer.name} ({customer.apartment} {customer.unit_number})
            </p>
            <p className="text-xs text-gray-500 mt-1">
              예약일: {scheduled_date}
            </p>
          </div>

          {/* 당번 선택 */}
          <div>
            <label className="block text-sm font-medium mb-2">당번 (작업자)</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="assigned_to"
                  value="me"
                  checked={assignedTo === 'me'}
                  onChange={(e) => setAssignedTo(e.target.value as 'me')}
                  className="mr-2"
                />
                <span className="text-sm">나(현재 로그인한 직원)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="assigned_to"
                  value="other"
                  checked={assignedTo === 'other'}
                  onChange={(e) => setAssignedTo(e.target.value as 'other')}
                  className="mr-2"
                />
                <span className="text-sm">다른 직원 선택</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="assigned_to"
                  value="admin"
                  checked={assignedTo === 'admin'}
                  onChange={(e) => setAssignedTo(e.target.value as 'admin')}
                  className="mr-2"
                />
                <span className="text-sm">사장(관리자 직접)</span>
              </label>
            </div>
          </div>

          {/* 다른 직원 선택 */}
          {assignedTo === 'other' && workers.length > 0 && (
            <div>
              <select
                value={selectedWorker}
                onChange={(e) => setSelectedWorker(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.phone && `(${w.phone})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 완료 시각 */}
          <div>
            <label className="block text-sm font-medium mb-2">완료 시각</label>
            <input
              type="time"
              value={completedTime}
              onChange={(e) => setCompletedTime(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          {/* 추가 작업 */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={hasInterior}
                onChange={(e) => setHasInterior(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">
                실내청소 (+10,000원)
              </span>
            </label>
            {hasInterior && (
              <p className="text-xs text-blue-600 mt-1">
                금액: {vehicle.unit_price.toLocaleString()} + 10,000 = {calculatePrice().toLocaleString()}원
              </p>
            )}
          </div>

          {/* 예상 청구액 */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">예상 청구액</p>
            <p className="text-lg font-bold">
              {calculatePrice().toLocaleString()}원
            </p>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium mb-2">메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="특이사항 기록..."
              className="w-full p-2 border rounded-lg text-sm"
              rows={3}
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? '처리중...' : '완료 처리'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 font-medium"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
