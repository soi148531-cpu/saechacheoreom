'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'

interface PayrollData {
  id: string
  worker_id: string
  worker_name: string
  year_month: string
  total_washes: number
  outdoor_wash_count?: number  // 실외세차 건수
  indoor_wash_count?: number   // 실내청소 건수
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
  carName: string
  plateNumber: string
  hasInteriorCleaning: boolean
  serviceType: string
}

interface PayrollDetailModalProps {
  payroll: PayrollData
  onClose: () => void
  onPaymentProcess: (payrollId: string, memo: string) => void
  onCancelPayment: (payrollId: string) => void
  onDeletePayroll?: (payrollId: string) => void
  onRefresh: () => void
}

export default function PayrollDetailModal({
  payroll,
  onClose,
  onPaymentProcess,
  onCancelPayment,
  onDeletePayroll,
  onRefresh
}: PayrollDetailModalProps) {
  const [details, setDetails] = useState<{
    worker: { id: string; name: string; phone: string; status: string }
    payroll: PayrollData & { status: string; outdoor_wash_count?: number; indoor_wash_count?: number }
    current_rates?: { outdoor_rate: number; indoor_rate: number }
    wash_records: WashRecord[]
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [showAddBonus, setShowAddBonus] = useState(false)
  const [bonusReason, setBonusReason] = useState('')
  const [bonusAmount, setBonusAmount] = useState('')
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentMemo, setPaymentMemo] = useState('')
  const [showEditAmount, setShowEditAmount] = useState(false)
  const [editAmount, setEditAmount] = useState(payroll.paid_amount.toString())
  const [currentPaidAmount, setCurrentPaidAmount] = useState(payroll.paid_amount)
  // 작업 내역 전체 접기/펼치기
  const [showWorkRecords, setShowWorkRecords] = useState(false)

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

  const handleEditAmount = async () => {
    if (!editAmount) {
      alert('수정할 금액을 입력해주세요')
      return
    }

    const newAmount = parseInt(editAmount)
    if (isNaN(newAmount) || newAmount < 0) {
      alert('올바른 금액을 입력해주세요')
      return
    }

    console.log('금액 수정 시작:', { payrollId: payroll.id, newAmount })

    try {
      const response = await fetch(`/api/payroll/${payroll.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paid_amount: newAmount
        })
      })

      console.log('응답 상태:', response.status)
      const result = await response.json()
      console.log('응답 결과:', result)

      if (response.ok && result.success) {
        alert('지급액이 수정되었습니다')
        setCurrentPaidAmount(newAmount)
        setShowEditAmount(false)
        // details 객체도 업데이트
        if (details) {
          setDetails({
            ...details,
            payroll: {
              ...details.payroll,
              paid_amount: newAmount
            }
          })
        }
        onRefresh()
      } else {
        alert('금액 수정 실패: ' + (result.error || '알 수 없는 오류'))
      }
    } catch (error) {
      console.error('금액 수정 실패:', error)
      alert('금액 수정 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 flex items-center justify-between bg-white p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {payroll.worker_name} — {payroll.year_month} 정산
          </h2>
          <div className="flex items-center gap-2">
            {onDeletePayroll && (
              <button
                onClick={() => onDeletePayroll(payroll.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="정산 기록 삭제"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">로딩 중...</div>
        ) : details ? (
          <div className="p-6 space-y-6">
            {/* 정산 계산 공식 */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border-2 border-green-200">
              <p className="text-xs font-semibold text-gray-700 mb-3">📊 급여 계산 방식</p>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex items-center justify-between py-1 px-2 bg-white rounded">
                  <span>실외세차</span>
                  <span className="font-semibold text-gray-900">{details?.payroll.outdoor_wash_count || 0}건 × ₩{(details?.current_rates?.outdoor_rate || 10000).toLocaleString()} = ₩{((details?.payroll.outdoor_wash_count || 0) * (details?.current_rates?.outdoor_rate || 10000)).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-1 px-2 bg-white rounded">
                  <span>실내청소</span>
                  <span className="font-semibold text-gray-900">{details?.payroll.indoor_wash_count || 0}건 × ₩{(details?.current_rates?.indoor_rate || 10000).toLocaleString()} = ₩{((details?.payroll.indoor_wash_count || 0) * (details?.current_rates?.indoor_rate || 10000)).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-1 px-2 bg-white rounded">
                  <span>기타금액</span>
                  <span className="font-semibold text-gray-900">{payroll.bonus_amount > 0 ? `₩${payroll.bonus_amount.toLocaleString()}` : '0원'}</span>
                </div>
                <div className="border-t border-green-200 pt-2 mt-2 flex items-center justify-between py-1 px-2 bg-green-50 rounded font-semibold text-green-900">
                  <span>= 총 지급액</span>
                  <span>₩{(details?.payroll.paid_amount ?? payroll.paid_amount).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* 정산 요약 */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-4">정산 요약</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">실외세차</p>
                  <p className="text-lg font-bold text-gray-900">{details?.payroll.outdoor_wash_count || 0}건</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">실내청소</p>
                  <p className="text-lg font-bold text-gray-900">{details?.payroll.indoor_wash_count || 0}건</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">기본 정산액</p>
                  <p className="text-lg font-bold text-gray-900">₩{payroll.total_amount.toLocaleString()}</p>
                </div>
              </div>

              {/* 기타금액 추가 섹션 */}
              <div className="bg-amber-50 rounded-lg p-4 mb-4 border border-amber-200 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-amber-900">🔹 기타금액 추가</p>
                  <p className="text-xs text-amber-700">(위 계산 외 추가비용)</p>
                  {payroll.status === 'unpaid' && (
                    <button
                      onClick={() => setShowAddBonus(!showAddBonus)}
                      className="text-amber-600 hover:text-amber-800 text-sm font-medium flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      기타금액 추가
                    </button>
                  )}
                </div>

                {showAddBonus && (
                  <div className="bg-white rounded-lg p-4 mb-3 border border-amber-300">
                    <div className="space-y-3 mb-3">
                      <div>
                        <label className="text-xs text-gray-600 font-medium block mb-1">
                          기타금액 사유 (선택사항)
                        </label>
                        <select
                          value={bonusReason}
                          onChange={e => setBonusReason(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">사유 선택 안함</option>
                          <option value="야간작업">야간작업</option>
                          <option value="추가작업">추가작업</option>
                          <option value="특별보너스">특별보너스</option>
                          <option value="기타">기타</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 font-medium block mb-1">
                          금액 (원)
                        </label>
                        <input
                          type="number"
                          value={bonusAmount}
                          onChange={e => setBonusAmount(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          min={0}
                          step={10000}
                          placeholder="예: 50000"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleAddBonus}
                      disabled={!bonusAmount}
                      className="w-full bg-amber-600 text-white py-2 rounded-lg font-medium hover:bg-amber-700 disabled:bg-gray-300 transition-colors"
                    >
                      저장
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-amber-200">
                  <p className="text-sm text-amber-900 font-semibold">현재 기타금액</p>
                  <p className="text-lg font-bold text-amber-600">
                    {payroll.bonus_amount > 0 ? `₩${payroll.bonus_amount.toLocaleString()}` : '-'}
                  </p>
                </div>
              </div>

              {/* 최종 지급액 */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">최종 지급액</p>
                  {payroll.status === 'unpaid' && (
                    <button
                      onClick={() => {
                        setShowEditAmount(!showEditAmount)
                        setEditAmount(payroll.paid_amount.toString())
                      }}
                      className="text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30 font-medium"
                    >
                      수정
                    </button>
                  )}
                </div>
                <p className="text-3xl font-bold mb-3">₩{(details?.payroll.paid_amount ?? currentPaidAmount).toLocaleString()}</p>
                
                {/* 계산 상세 */}
                <div className="bg-white/10 rounded-lg p-3 text-xs text-blue-100 space-y-1">
                  <div className="flex justify-between">
                    <span>기본정산액</span>
                    <span>₩{payroll.total_amount.toLocaleString()}</span>
                  </div>
                  {payroll.bonus_amount > 0 && (
                    <div className="flex justify-between">
                      <span>기타금액</span>
                      <span>+ ₩{payroll.bonus_amount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t border-white/30 pt-1 flex justify-between font-semibold">
                    <span>총액</span>
                    <span>₩{(details?.payroll.paid_amount ?? currentPaidAmount).toLocaleString()}</span>
                  </div>
                </div>

                {showEditAmount && (
                  <div className="mt-4 pt-4 border-t border-blue-300 space-y-2">
                    <div>
                      <label className="text-xs text-blue-100 font-medium block mb-1">
                        수정할 금액 (원)
                      </label>
                      <input
                        type="number"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
                        min={0}
                        step={10000}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleEditAmount}
                        className="flex-1 bg-white text-blue-600 py-1.5 rounded-lg font-medium hover:bg-blue-50 transition-colors text-sm"
                      >
                        적용
                      </button>
                      <button
                        onClick={() => setShowEditAmount(false)}
                        className="flex-1 bg-white/20 text-white py-1.5 rounded-lg font-medium hover:bg-white/30 transition-colors text-sm"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 작업 내역 상세 */}
            <div>
              {/* 전체 작업 내역 헤더 - 클릭하면 펼치기/접기 */}
              <button
                onClick={() => setShowWorkRecords(!showWorkRecords)}
                className="w-full mb-4 bg-blue-50 hover:bg-blue-100 px-4 py-3 flex items-center justify-between rounded-lg border-l-4 border-blue-500 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold">{showWorkRecords ? '▼' : '▶'}</span>
                  <h3 className="text-sm font-semibold text-blue-900">작업 내역 상세</h3>
                </div>
                <span className="text-xs bg-blue-200 text-blue-900 font-semibold px-3 py-1 rounded">
                  {details.wash_records.length}건
                </span>
              </button>

              {/* 작업 목록 - 전체 펼쳤을 때만 표시 */}
              {showWorkRecords && (
                <div className="space-y-3">
                  {(() => {
                    // 날짜별로 그룹화
                    const groupedByDate: { [key: string]: typeof details.wash_records } = {}
                    details.wash_records.forEach(record => {
                      if (!groupedByDate[record.date]) {
                        groupedByDate[record.date] = []
                      }
                      groupedByDate[record.date].push(record)
                    })

                    // 날짜 순서대로 정렬 (최신순)
                    const sortedDates = Object.keys(groupedByDate).sort().reverse()

                    return sortedDates.map(date => {
                      const dayRecordCount = groupedByDate[date].length

                      return (
                        <div key={date} className="ml-4 pb-4 border-b border-gray-200 last:border-b-0">
                          {/* 날짜 구분자 */}
                          <p className="text-xs font-semibold text-gray-500 mb-2 bg-gray-100 inline-block px-2 py-1 rounded">
                            {new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              weekday: 'short'
                            })} ({dayRecordCount}건)
                          </p>

                          {/* 해당 날짜의 작업 목록 */}
                          <div className="space-y-2">
                            {groupedByDate[date].map((record, idx) => (
                              <div
                                key={record.id}
                                className="p-3 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded min-w-fit">
                                    #{idx + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 mb-1 break-words">
                                      🚗 {record.carName}
                                    </p>
                                    <p className="text-xs text-gray-600 mb-1 break-all">
                                      📋 {record.plateNumber}
                                    </p>
                                    {record.hasInteriorCleaning && (
                                      <p className="text-xs text-blue-600 font-medium mt-1 bg-blue-50 inline-block px-2 py-1 rounded">
                                        ✨ 실내청소 포함
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              )}

              {/* 급여 계산 공식 설명 */}
              {showWorkRecords && (
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                  <p className="text-xs text-gray-700 font-medium mb-2">📊 급여 계산 방식</p>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>• 실외세차: 기본료 × 건수</p>
                    <p>• 실내청소: 추가료 × 건수</p>
                    <p className="font-semibold text-gray-900 mt-2">→ 총 금액은 상단에 표시됩니다</p>
                  </div>
                </div>
              )}

              {/* 작업 집계 */}
              {showWorkRecords && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-semibold text-green-900 mb-2">✓ 작업 건수: {details.wash_records.length}건</p>
                  <div className="text-xs text-green-700 space-y-1">
                    {(() => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const interiorCount = details.wash_records.filter((r: any) => r.hasInteriorCleaning).length
                      const regularCount = details.wash_records.length - interiorCount
                      return (
                        <>
                          {regularCount > 0 && <p>• 실외세차: {regularCount}건</p>}
                          {interiorCount > 0 && <p>• 실내청소 포함: {interiorCount}건</p>}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
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
              <div className="bg-green-50 p-4 rounded-lg border border-green-200 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-green-900 mb-2">지급 완료</p>
                  <p className="text-xs text-green-800 mb-3">
                    {payroll.paid_at && `${new Date(payroll.paid_at).toLocaleDateString('ko-KR')} ${new Date(payroll.paid_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                  {payroll.memo && (
                    <p className="text-xs text-green-800 mb-3">방식: {payroll.memo}</p>
                  )}
                </div>

                {/* 금액 수정 섹션 (지급 후) */}
                <div>
                  <p className="text-xs font-semibold text-green-900 mb-2">금액 수정/취소</p>
                  {showEditAmount ? (
                    <div className="space-y-2">
                      <input
                        type="number"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                        min={0}
                        step={10000}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleEditAmount}
                          className="flex-1 bg-green-600 text-white py-1.5 rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
                        >
                          적용
                        </button>
                        <button
                          onClick={() => setShowEditAmount(false)}
                          className="flex-1 bg-gray-300 text-gray-700 py-1.5 rounded-lg font-medium hover:bg-gray-400 transition-colors text-sm"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowEditAmount(true)}
                      className="w-full bg-green-200 text-green-900 py-1.5 rounded-lg font-medium hover:bg-green-300 transition-colors text-sm"
                    >
                      금액 수정
                    </button>
                  )}
                </div>

                {/* 지급 취소 */}
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
