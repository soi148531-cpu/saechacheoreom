/* eslint-disable @typescript-eslint/no-explicit-any */

'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface SalaryLedgerModalProps {
  yearMonth: string
  onClose: () => void
}

export default function SalaryLedgerModal({ yearMonth, onClose }: SalaryLedgerModalProps) {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/payroll/salary-ledger/${yearMonth}`)
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        }
      } catch (error) {
        console.error('급여부 조회 실패:', error)
      }
    }
    fetchData()
  }, [yearMonth])

  if (!data)
    return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between border-b">
          <div>
            <h2 className="text-2xl font-bold">급여대장</h2>
            <p className="text-blue-100 text-sm mt-1">{data.company_name} | {data.year_month}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 space-y-8">
          {/* 요약 정보 */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
            <h3 className="font-bold text-lg text-gray-900 mb-4">정산 요약</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div>
                <p className="text-sm text-gray-600">총 직원수</p>
                <p className="text-2xl font-bold text-gray-900">{data.summary.총직원수}명</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">총 세차건수</p>
                <p className="text-2xl font-bold text-gray-900">{data.summary.총세차건수}건</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">총 기본급여</p>
                <p className="text-xl font-bold text-gray-900">
                  ₩{(data.summary.총기본급여 / 1000).toFixed(0)}K
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">총 추가금액</p>
                <p className="text-xl font-bold text-blue-600">
                  +₩{(data.summary.총추가금액 / 1000).toFixed(0)}K
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">총 지급액</p>
                <p className="text-2xl font-bold text-green-600">
                  ₩{(data.summary.총지급액 / 1000).toFixed(0)}K
                </p>
              </div>
              <div className="col-span-2 md:col-span-1">
                <p className="text-xs text-gray-600 mb-2">지급현황</p>
                <div className="flex gap-2">
                  <div className="text-center">
                    <p className="font-bold text-green-600">{data.summary.지급완료}</p>
                    <p className="text-xs text-gray-500">완료</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-orange-600">{data.summary.미지급}</p>
                    <p className="text-xs text-gray-500">미지급</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 직원별 급여 테이블 */}
          <div>
            <h3 className="font-bold text-lg text-gray-900 mb-4">직원별 정산 현황</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">순번</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">이름</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">세차건수</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">기본급여</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">추가금액</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">최종지급액</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">지급여부</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">지급방법</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ledger.map((row: any, idx: number) => (
                    <tr
                      key={idx}
                      className={`border-b hover:bg-gray-50 transition-colors ${
                        row.지급여부 === '지급' ? 'bg-green-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">{row.순번}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.이름}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.세차건수}건</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        ₩{row.기본급여.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {row.추가금액 > 0 ? (
                          <span className="text-blue-600 font-semibold">
                            +₩{row.추가금액.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        ₩{row.최종지급액.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.지급여부 === '지급' ? (
                          <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                            지급
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                            미지급
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {row.지급방법 !== '-' ? row.지급방법 : '미정'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 합계 행 */}
          <div className="bg-gray-100 rounded-lg p-6 border border-gray-300">
            <h4 className="font-bold text-gray-900 mb-4">합 계</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded border">
                <p className="text-xs text-gray-600 mb-1">총 직원</p>
                <p className="text-xl font-bold text-gray-900">{data.summary.총직원수}명</p>
              </div>
              <div className="bg-white p-4 rounded border">
                <p className="text-xs text-gray-600 mb-1">총 건수</p>
                <p className="text-xl font-bold text-gray-900">{data.summary.총세차건수}건</p>
              </div>
              <div className="bg-white p-4 rounded border">
                <p className="text-xs text-gray-600 mb-1">기본급여</p>
                <p className="text-lg font-bold text-gray-900">
                  ₩{data.summary.총기본급여.toLocaleString()}
                </p>
              </div>
              <div className="bg-white p-4 rounded border">
                <p className="text-xs text-gray-600 mb-1">추가금액</p>
                <p className="text-lg font-bold text-blue-600">
                  ₩{data.summary.총추가금액.toLocaleString()}
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded border-2 border-green-300">
                <p className="text-xs text-gray-600 mb-1">최종지급액</p>
                <p className="text-xl font-bold text-green-700">
                  ₩{data.summary.총지급액.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* 생성정보 */}
          <div className="text-xs text-gray-500 p-4 bg-gray-50 rounded border">
            생성일시: {new Date(data.created_at).toLocaleString('ko-KR')}
          </div>
        </div>
      </div>
    </div>
  )
}
