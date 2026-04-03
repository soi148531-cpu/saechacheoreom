'use client'

import { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'

interface PayrollData {
  id: string
  worker_id: string
  worker_name: string
  year_month: string
  total_washes: number
  total_amount: number
  bonus_amount: number
  paid_amount: number
  paid_at: string | null
  memo: string
  status: 'paid' | 'unpaid'
}

interface WashRecord {
  id: string
  date: string
  vehicle_name: string
  license_plate: string
  customer_name: string
  price: number
  service_type: string
}

interface PayrollDetailModalProps {
  payroll: PayrollData
  onClose: () => void
  onPaymentProcess: (payrollId: string, memo: string) => void
  onCancelPayment: (payrollId: string) => void
  onRefresh: () => void
}

export default function PayrollDetailModal({
  payroll,
  onClose,
  onPaymentProcess,
  onCancelPayment,
  onRefresh
}: PayrollDetailModalProps) {
  const [details, setDetails] = useState<{
    worker: { id: string; name: string; phone: string; status: string }
    payroll: PayrollData & { status: string }
    wash_records: WashRecord[]
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [showAddBonus, setShowAddBonus] = useState(false)
  const [bonusReason, setBonusReason] = useState('')
  const [bonusAmount, setBonusAmount] = useState('')
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentMemo, setPaymentMemo] = useState('')

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await fetch(`/api/payroll/${payroll.id}/details`)
        const result = await response.json()
        if (result.success) {
          setDetails(result.data)
        }
      } catch (error) {
        console.error('상세 정보 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDetails()
  }, [payroll.id])

  const handleAddBonus = async () => {
    if (!bonusAmount) {
      alert('추가금액을 입력해주세요')
      return
    }

    try {
      const response = await fetch(`/api/payroll/${payroll.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bonus_amount: parseInt(bonusAmount)
        })
      })

      if (response.ok) {
        alert('추가금액이 적용되었습니다')
        setBonusReason('')
        setBonusAmount('')
        setShowAddBonus(false)
        onRefresh()
      }
    } catch (error) {
      console.error('추가금액 추가 실패:', error)
    }
  }

  const handlePayment = () => {
    if (!paymentMemo) {
      alert('지급 방식을 입력해주세요')
      return
    }

    onPaymentProcess(payroll.id, paymentMemo)
    setShowPaymentForm(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 flex items-center justify-between bg-white p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {payroll.worker_name} — {payroll.year_month} 정산
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">로딩 중...</div>
        ) : details ? (
          <div className="p-6 space-y-6">
            {/* 정산 요약 */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-4">정산 요약</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">세차건수</p>
                  <p className="text-lg font-bold text-gray-900">{payroll.total_washes}건</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">기본 정산액</p>
                  <p className="text-lg font-bold text-gray-900">₩{payroll.total_amount.toLocaleString()}</p>
                </div>
              </div>

              {/* 추가금액 */}
              <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-blue-900">추가금액</p>
                  {payroll.status === 'unpaid' && (
                    <button
                      onClick={() => setShowAddBonus(!showAddBonus)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      추가
                    </button>
                  )}
                </div>

                {showAddBonus && (
                  <div className="bg-white rounded-lg p-4 mb-3 border border-blue-300">
                    <div className="space-y-3 mb-3">
                      <div>
                        <label className="text-xs text-gray-600 font-medium block mb-1">
                          추가금액 사유
                        </label>
                        <select
                          value={bonusReason}
                          onChange={e => setBonusReason(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">사유 선택</option>
                          <option value="excellence">우수상</option>
                          <option value="special">특별보너스</option>
                          <option value="other">기타</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 font-medium block mb-1">
                          추가금액 (원)
                        </label>
                        <input
                          type="number"
                          value={bonusAmount}
                          onChange={e => setBonusAmount(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min={0}
                          step={10000}
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleAddBonus}
                      disabled={!bonusAmount}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                    >
                      저장
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                  <p className="text-sm text-blue-900 font-semibold">현재 추가금액</p>
                  <p className="text-lg font-bold text-blue-600">
                    {payroll.bonus_amount > 0 ? `₩${payroll.bonus_amount.toLocaleString()}` : '-'}
                  </p>
                </div>
              </div>

              {/* 최종 지급액 */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white">
                <p className="text-sm font-semibold mb-1">최종 지급액</p>
                <p className="text-3xl font-bold">₩{payroll.paid_amount.toLocaleString()}</p>
                {payroll.bonus_amount > 0 && (
                  <p className="text-xs text-blue-100 mt-2">
                    (기본 ₩{payroll.total_amount.toLocaleString()} + 추가 ₩{payroll.bonus_amount.toLocaleString()})
                  </p>
                )}
              </div>
            </div>

            {/* 세차 기록 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-4">세차 기록 ({details.wash_records.length}건)</h3>
              <div className="space-y-2">
                {details.wash_records.map(record => (
                  <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{record.customer_name}</p>
                      <p className="text-xs text-gray-500">{record.vehicle_name} ({record.license_plate})</p>
                      <p className="text-xs text-gray-400">{record.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">세차비</p>
                      <p className="text-sm font-semibold text-gray-900">₩{record.price.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 지급처리 */}
            {payroll.status === 'unpaid' ? (
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <p className="text-sm font-semibold text-orange-900 mb-3">지급처리</p>
                {!showPaymentForm ? (
                  <button
                    onClick={() => setShowPaymentForm(true)}
                    className="w-full bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors"
                  >
                    지급 처리하기
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 font-medium block mb-1">
                        지급 방식/메모
                      </label>
                      <select
                        value={paymentMemo}
                        onChange={e => setPaymentMemo(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">지급 방식 선택</option>
                        <option value="카드 결제">카드 결제</option>
                        <option value="계좌이체">계좌이체</option>
                        <option value="현금">현금</option>
                        <option value="기타">기타</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handlePayment}
                        disabled={!paymentMemo}
                        className="flex-1 bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 disabled:bg-gray-300 transition-colors"
                      >
                        지급 완료
                      </button>
                      <button
                        onClick={() => setShowPaymentForm(false)}
                        className="flex-1 bg-gray-300 text-gray-900 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-sm font-semibold text-green-900 mb-2">지급 완료</p>
                <p className="text-xs text-green-800 mb-3">
                  {payroll.paid_at && `${new Date(payroll.paid_at).toLocaleDateString('ko-KR')} ${new Date(payroll.paid_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
                </p>
                {payroll.memo && (
                  <p className="text-xs text-green-800 mb-3">방식: {payroll.memo}</p>
                )}
                <button
                  onClick={() => onCancelPayment(payroll.id)}
                  className="w-full bg-red-300 text-red-900 py-2 rounded-lg font-medium hover:bg-red-400 transition-colors text-sm"
                >
                  지급 취소
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-red-500">정보를 불러올 수 없습니다</div>
        )}
      </div>
    </div>
  )
}
