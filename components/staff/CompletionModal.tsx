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

type WorkType = 'exterior' | 'interior_only' | 'both'

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
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('')
  const [completedAt, setCompletedAt] = useState('')
  const [workType, setWorkType] = useState<WorkType>('exterior')
  const [interiorOnlyPrice, setInteriorOnlyPrice] = useState<number>(20000)
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

  // 직원 목록 불러오기 — 모달이 열릴 때 1회만 실행
  useEffect(() => {
    if (!isOpen) return
    setError('')
    setWorkType('exterior')
    setInteriorOnlyPrice(20000)
    const fetchWorkers = async () => {
      try {
        const res = await fetch('/api/workers')
        if (!res.ok) return
        const json = await res.json()
        let data = (json.data || json) as Worker[]
        data = Array.from(new Map(data.map(w => [w.id, w])).values())
        setWorkers(data)
        if (data.length > 0) {
          setSelectedWorkerId(data[0].id)
        }
      } catch (err) {
        console.error('Failed to fetch workers:', err)
      }
    }
    fetchWorkers()
  }, [isOpen])

  const calculatePrice = () => {
    if (workType === 'exterior') return vehicle.unit_price || 0
    if (workType === 'both') return (vehicle.unit_price || 0) + 10000
    return interiorOnlyPrice
  }

  const getServiceType = () => {
    if (workType === 'both') return 'interior'
    if (workType === 'interior_only') return 'interior_only'
    return 'regular'
  }

  const selectedWorkerObj = workers.find(w => w.id === selectedWorkerId)

  const handleSubmit = async () => {
    setError('')

    if (!selectedWorkerId || !selectedWorkerObj) {
      setError('작업자를 선택해주세요')
      return
    }

    if (workType === 'interior_only' && interiorOnlyPrice <= 0) {
      setError('실내 작업 금액을 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const finalPrice = calculatePrice()
      const wash_date = scheduled_date
      const [hours, mins] = completedAt.split(':')
      const completedAtISO = `${wash_date}T${hours}:${mins}:00`

      const response = await fetch('/api/wash-records/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicle.id,
          schedule_id,
          wash_date,
          price: finalPrice,
          service_type: getServiceType(),
          worker_id: selectedWorkerId,
          worked_by: 'worker',
          completed_by: selectedWorkerObj.name,
          completed_at: completedAtISO,
          memo: memo.trim() || null,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || result.message || '완료 처리 실패')
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
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 space-y-4">
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

          {/* 당번(작업자) 선택 */}
          <div className="border-t border-gray-100 pt-3">
            <label className="block text-xs font-bold text-gray-700 mb-2">
              당번 (작업자)
            </label>
            {workers.length === 0 ? (
              <p className="text-xs text-gray-400">직원 목록 불러오는 중...</p>
            ) : (
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
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

          {/* 작업 유형 */}
          <div className="border-t border-gray-100 pt-3">
            <label className="block text-xs font-bold text-gray-700 mb-2">작업 유형</label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="work_type"
                  value="exterior"
                  checked={workType === 'exterior'}
                  onChange={() => setWorkType('exterior')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">외부 세차</span>
                <span className="text-xs text-gray-400 ml-2">({(vehicle.unit_price || 0).toLocaleString()}원)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="work_type"
                  value="both"
                  checked={workType === 'both'}
                  onChange={() => setWorkType('both')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">외부 + 실내 세차</span>
                <span className="text-xs text-gray-400 ml-2">({(vehicle.unit_price || 0).toLocaleString()} + 10,000원)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="work_type"
                  value="interior_only"
                  checked={workType === 'interior_only'}
                  onChange={() => setWorkType('interior_only')}
                  className="mr-2"
                />
                <span className="text-sm font-semibold text-orange-700">실내 전용</span>
                <span className="text-xs text-orange-500 ml-2">(가격 직접 입력)</span>
              </label>
            </div>

            {/* 실내 전용 가격 입력 */}
            {workType === 'interior_only' && (
              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <label className="block text-xs font-medium text-orange-800 mb-1">
                  실내 작업 금액
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={interiorOnlyPrice}
                    onChange={(e) => setInteriorOnlyPrice(Number(e.target.value))}
                    className="flex-1 px-3 py-2 border border-orange-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-400"
                    min={0}
                    step={1000}
                  />
                  <span className="text-sm text-orange-700 whitespace-nowrap">원</span>
                </div>
                <p className="text-xs text-orange-600 mt-1">고객과 협상한 금액으로 변경하세요</p>
              </div>
            )}
          </div>

          {/* 예상 청구액 */}
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-xs text-gray-600">
              {workType === 'interior_only' ? '청구 금액 (협상가)' : '예상 청구액'}
            </p>
            <p className="text-lg font-bold text-blue-600">
              {calculatePrice().toLocaleString()}원
            </p>
            {workType === 'interior_only' && (
              <p className="text-xs text-orange-600 mt-1">실내 전용 작업</p>
            )}
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
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 p-4 flex gap-2 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || workers.length === 0 || !selectedWorkerId}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>처리 중...</span>
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
