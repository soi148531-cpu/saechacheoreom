'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Download, Check, BarChart3, Eye } from 'lucide-react'
import PayrollDetailModal from '@/components/admin/PayrollDetailModal'
import PayrollStatistics from '@/components/admin/PayrollStatistics'
import SalaryLedgerModal from '@/components/admin/SalaryLedgerModal'

export interface PayrollData {
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

interface Summary {
  total_workers: number
  total_washes: number
  total_payroll: number
  unpaid_count: number
  paid_count: number
}

export default function PayrollPage() {
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const [payrolls, setPayrolls] = useState<PayrollData[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollData | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showBatchPayModal, setShowBatchPayModal] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [batchPayLoading, setBatchPayLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'payroll' | 'statistics'>('payroll')
  const [showSalaryLedger, setShowSalaryLedger] = useState(false)

  const year = currentDate.getFullYear()
  const month = String(currentDate.getMonth() + 1).padStart(2, '0')
  const yearMonth = `${year}-${month}`

  // 정산 데이터 조회
  const fetchPayrolls = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/payroll?year_month=${yearMonth}`)
      const result = await response.json()

      if (result.success) {
        setPayrolls(result.data)
        setSummary(result.summary)
      }
    } catch (error) {
      console.error('정산 데이터 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [yearMonth])

  useEffect(() => {
    fetchPayrolls()
  }, [yearMonth, fetchPayrolls])

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleGeneratePayroll = async () => {
    if (confirm(`${yearMonth} 정산 데이터를 생성하시겠습니까?`)) {
      try {
        const response = await fetch('/api/payroll/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year_month: yearMonth })
        })

        if (response.ok) {
          alert('정산 데이터가 생성되었습니다')
          fetchPayrolls()
        }
      } catch (error) {
        console.error('정산 생성 실패:', error)
      }
    }
  }

  const handlePaymentProcess = async (payrollId: string, memo: string) => {
    try {
      const response = await fetch(`/api/payroll/${payrollId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paid_at: new Date().toISOString(),
          memo: memo
        })
      })

      if (response.ok) {
        alert('지급 처리되었습니다')
        fetchPayrolls()
        setShowDetailModal(false)
      }
    } catch (error) {
      console.error('지급 처리 실패:', error)
    }
  }

  const handleCancelPayment = async (payrollId: string) => {
    if (confirm('지급 처리를 취소하시겠습니까?')) {
      try {
        const response = await fetch(`/api/payroll/${payrollId}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          alert('지급 처리가 취소되었습니다')
          fetchPayrolls()
        }
      } catch (error) {
        console.error('지급 취소 실패:', error)
      }
    }
  }

  const handleDownloadCSV = () => {
    if (!payrolls || payrolls.length === 0) {
      alert('다운로드할 데이터가 없습니다')
      return
    }

    const headers = ['직원명', '년월', '세차건수', '정산액', '추가금액', '지급액', '지급일', '메모']
    const rows = payrolls.map(p => [
      p.worker_name,
      p.year_month,
      p.total_washes.toString(),
      p.total_amount.toString(),
      p.bonus_amount.toString(),
      p.paid_amount.toString(),
      p.paid_at ? new Date(p.paid_at).toLocaleDateString('ko-KR') : '',
      p.memo
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = `payroll_${yearMonth}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadSalaryLedger = async () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    if (!payrolls || payrolls.length === 0) {
      alert('보기할 데이터가 없습니다')
      return
    }
    setShowSalaryLedger(true)
  }

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedItems.size === payrolls.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(payrolls.map(p => p.id)))
    }
  }

  const handleBatchPay = async () => {
    if (selectedItems.size === 0) {
      alert('지급할 작업자를 선택해주세요')
      return
    }

    if (!selectedPaymentMethod) {
      alert('지급 방법을 선택해주세요')
      return
    }

    if (confirm(`${selectedItems.size}명의 작업자에게 일괄 지급하시겠습니까?`)) {
      setBatchPayLoading(true)
      try {
        const response = await fetch('/api/payroll/batch-pay', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payroll_ids: Array.from(selectedItems),
            memo: selectedPaymentMethod
          })
        })

        if (response.ok) {
          alert(`${selectedItems.size}명의 작업자 지급 처리가 완료되었습니다`)
          setSelectedItems(new Set())
          setShowBatchPayModal(false)
          setSelectedPaymentMethod('')
          fetchPayrolls()
        } else {
          alert('일괄 지급 처리에 실패했습니다')
        }
      } catch (error) {
        console.error('일괄 지급 실패:', error)
        alert('일괄 지급 처리 중 오류가 발생했습니다')
      } finally {
        setBatchPayLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">작업자 정산</h1>
          <p className="text-gray-600">월별 작업자 세차 정산 및 지급 관리</p>
        </div>

        {/* 탭 */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'payroll'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            정산 관리
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'statistics'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            통계
          </button>
        </div>

        {/* 월별 선택 및 액션 */}
        {activeTab === 'payroll' && (
          <>
            <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="text-lg font-semibold text-gray-900 min-w-32 text-center">
                  {currentDate.getFullYear()}년 {String(currentDate.getMonth() + 1).padStart(2, '0')}월
                </div>

                <button
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleGeneratePayroll}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  정산 생성
                </button>
                {selectedItems.size > 0 && (
                  <button
                    onClick={() => setShowBatchPayModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    일괄 지급 ({selectedItems.size})
                  </button>
                )}
                <button
                  onClick={handleDownloadCSV}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  CSV 다운로드
                </button>
                <button
                  onClick={handleDownloadSalaryLedger}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  급여부 보기
                </button>
              </div>
            </div>

            {/* 정산 현황 요약 */}
            {summary && (
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="text-sm text-gray-600 mb-2">총 정산액</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ₩{(summary.total_payroll / 1000).toFixed(0)}K
                  </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="text-sm text-gray-600 mb-2">직원 수</div>
                  <div className="text-2xl font-bold text-gray-900">{summary.total_workers}명</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="text-sm text-gray-600 mb-2">미지급</div>
                  <div className="text-2xl font-bold text-orange-600">{summary.unpaid_count}명</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="text-sm text-gray-600 mb-2">지급완료</div>
                  <div className="text-2xl font-bold text-green-600">{summary.paid_count}명</div>
                </div>
              </div>
            )}

            {/* 정산 테이블 */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-gray-900 w-10">
                        <input
                          type="checkbox"
                          checked={selectedItems.size === payrolls.length && payrolls.length > 0}
                          onChange={handleSelectAll}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">직원명</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">세차건수</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">정산액</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">추가금액</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">지급액</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">상태</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                          로딩 중...
                        </td>
                      </tr>
                    ) : payrolls.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                          정산 데이터가 없습니다. [정산 생성] 버튼을 클릭하여 생성해주세요.
                        </td>
                      </tr>
                    ) : (
                      payrolls.map(payroll => (
                        <tr
                          key={payroll.id}
                          className={`border-b hover:bg-gray-50 transition-colors ${
                            payroll.status === 'paid' ? 'bg-gray-50' : ''
                          }`}
                        >
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedItems.has(payroll.id)}
                              onChange={() => handleSelectItem(payroll.id)}
                              disabled={payroll.status === 'paid'}
                              className="w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {payroll.worker_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{payroll.total_washes}건</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            ₩{payroll.total_amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {payroll.bonus_amount > 0 ? (
                              <span className="text-blue-600">+₩{payroll.bonus_amount.toLocaleString()}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            ₩{payroll.paid_amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {payroll.status === 'paid' ? (
                              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                지급완료
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                                미지급
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={() => {
                                setSelectedPayroll(payroll)
                                setShowDetailModal(true)
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              상세보기
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 통계 탭 */}
        {activeTab === 'statistics' && <PayrollStatistics payrolls={payrolls} />}
      </div>

      {/* 상세 모달 */}
      {showDetailModal && selectedPayroll && (
        <PayrollDetailModal
          payroll={selectedPayroll}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedPayroll(null)
          }}
          onPaymentProcess={handlePaymentProcess}
          onCancelPayment={handleCancelPayment}
          onRefresh={fetchPayrolls}
        />
      )}

      {/* 일괄 지급 모달 */}
      {showBatchPayModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {selectedItems.size}명에게 일괄 지급
            </h2>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">지급 예정액</p>
              <p className="text-2xl font-bold text-gray-900">
                ₩{payrolls
                  .filter(p => selectedItems.has(p.id))
                  .reduce((sum, p) => sum + p.paid_amount, 0)
                  .toLocaleString()}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                지급 방법 선택
              </label>
              <select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- 선택해주세요 --</option>
                <option value="카드 결제">카드 결제</option>
                <option value="계좌이체">계좌이체</option>
                <option value="현금">현금</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBatchPayModal(false)
                  setSelectedPaymentMethod('')
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                disabled={batchPayLoading}
              >
                취소
              </button>
              <button
                onClick={handleBatchPay}
                disabled={batchPayLoading || !selectedPaymentMethod}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
              >
                {batchPayLoading ? '처리 중...' : '지급 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSalaryLedger && (
        <SalaryLedgerModal 
          yearMonth={yearMonth} 
          onClose={() => setShowSalaryLedger(false)} 
        />
      )}
    </div>
  )
}