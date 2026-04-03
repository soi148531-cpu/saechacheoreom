/* eslint-disable @typescript-eslint/no-explicit-any */

'use client'

import { PayrollData } from '@/app/(admin)/payroll/page'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

interface PayrollStatisticsProps {
  payrolls: PayrollData[]
}

export default function PayrollStatistics({ payrolls }: PayrollStatisticsProps) {
  // 직원별 통계
  const workerStats = payrolls.reduce((acc, p) => {
    const existing = acc.find(w => w.name === p.worker_name)
    if (existing) {
      existing.정산액 += p.total_amount
      existing.추가금액 += p.bonus_amount
      existing.지급액 += p.paid_amount
      existing.세차건수 += p.total_washes
    } else {
      acc.push({
        name: p.worker_name,
        정산액: p.total_amount,
        추가금액: p.bonus_amount,
        지급액: p.paid_amount,
        세차건수: p.total_washes
      })
    }
    return acc
  }, [] as any[])

  // 지급 상태 분포
  const paymentStatus = [
    {
      name: '지급완료',
      value: payrolls.filter(p => p.status === 'paid').length,
      color: '#10b981'
    },
    {
      name: '미지급',
      value: payrolls.filter(p => p.status === 'unpaid').length,
      color: '#f97316'
    }
  ]

  // 건수별 통계
  const washStats = [
    {
      name: '20건 이상',
      value: payrolls.filter(p => p.total_washes >= 20).length
    },
    {
      name: '10-19건',
      value: payrolls.filter(p => p.total_washes >= 10 && p.total_washes < 20).length
    },
    {
      name: '10건 미만',
      value: payrolls.filter(p => p.total_washes < 10).length
    }
  ]

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899']

  return (
    <div className="space-y-8">
      {/* 직원별 정산액 비교 */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">직원별 정산액 비교</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={workerStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip formatter={(value: any) => `₩${(value as number).toLocaleString()}`} />
            <Legend />
            <Bar dataKey="정산액" fill="#3b82f6" />
            <Bar dataKey="추가금액" fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 직원별 지급액 */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">직원별 최종 지급액</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={workerStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip formatter={(value: any) => `₩${(value as number).toLocaleString()}`} />
            <Legend />
            <Line type="monotone" dataKey="지급액" stroke="#10b981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 지급 상태 분포 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">지급 상태 분포</h3>
          {paymentStatus.some(p => p.value > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={paymentStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} (${value}명)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-8">데이터가 없습니다</p>
          )}
        </div>

        {/* 세차 건수 분포 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">세차 건수 분포</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={washStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} (${value}명)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 상세 통계 테이블 */}
      <div className="bg-white p-6 rounded-lg shadow-sm overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">상세 통계</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">직원명</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">세차건수</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">정산액</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">추가금액</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">지급액</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">건당 평균</th>
              </tr>
            </thead>
            <tbody>
              {workerStats.map((worker, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{worker.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{worker.세차건수}건</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    ₩{worker.정산액.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-blue-600">
                    {worker.추가금액 > 0 ? `+₩${worker.추가금액.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    ₩{worker.지급액.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    ₩{worker.세차건수 > 0 ? Math.round(worker.지급액 / worker.세차건수).toLocaleString() : '0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
