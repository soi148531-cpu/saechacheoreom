'use client'

// Design Ref: §5.5 — 차량 이력 조회 (번호판 검색)
// Plan SC: SC-01

import { useState } from 'react'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CAR_GRADE_LABELS, MONTHLY_COUNT_LABELS } from '@/lib/constants/pricing'
import { formatPrice } from '@/lib/utils'
import type { Vehicle, WashRecord } from '@/types'

interface HistoryResult {
  vehicle: Vehicle & { customer?: { name: string } }
  records: WashRecord[]
}

export default function HistoryPage() {
  const supabase    = createClient()
  const [query,     setQuery]     = useState('')
  const [result,    setResult]    = useState<HistoryResult | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [searched,  setSearched]  = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)

    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('*, customer:customers(*)')
      .ilike('plate_number', `%${query.trim()}%`)
      .limit(1)

    if (!vehicles || vehicles.length === 0) {
      setResult(null)
      setLoading(false)
      return
    }

    const vehicle = vehicles[0] as Vehicle & { customer?: { name: string } }

    const { data: records } = await supabase
      .from('wash_records')
      .select('*, completed_by')
      .eq('vehicle_id', vehicle.id)
      .order('wash_date', { ascending: false })

    setResult({ vehicle, records: (records ?? []) as WashRecord[] })
    setLoading(false)
  }

  // 월별 그룹핑
  const byMonth: Record<string, WashRecord[]> = {}
  result?.records.forEach(r => {
    const ym = r.wash_date.slice(0, 7)
    if (!byMonth[ym]) byMonth[ym] = []
    byMonth[ym].push(r)
  })

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-5">이력 조회</h1>

      {/* 검색 */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="차량번호 일부 입력 (예: 2945)"
            className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          검색
        </button>
      </form>

      {/* 결과 */}
      {loading && <div className="text-center py-8 text-gray-400">검색 중...</div>}

      {!loading && searched && !result && (
        <div className="text-center py-8 text-gray-400 text-sm">
          일치하는 차량이 없습니다
        </div>
      )}

      {result && !loading && (
        <div>
          {/* 차량 정보 카드 */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-bold text-gray-900">{result.vehicle.car_name}</span>
              <span className="font-mono text-sm bg-white border border-blue-200 px-2 py-0.5 rounded text-blue-700">
                {result.vehicle.plate_number}
              </span>
            </div>
            <div className="text-sm text-gray-600 space-y-0.5">
              <p>{result.vehicle.customer?.name} · {result.vehicle.unit_number}</p>
              <p>
                {CAR_GRADE_LABELS[result.vehicle.car_grade]} ·{' '}
                {MONTHLY_COUNT_LABELS[result.vehicle.monthly_count]}
                {result.vehicle.unit_price && (
                  <> · 1회 {formatPrice(result.vehicle.unit_price)}</>
                )}
              </p>
            </div>
          </div>

          {/* 총 이력 수 */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-700">
              전체 이력 {result.records.length}건
            </span>
            {result.records.length > 0 && (
              <span className="text-sm text-gray-500">
                총 {formatPrice(result.records.reduce((sum, r) => sum + r.price, 0))}
              </span>
            )}
          </div>

          {/* 월별 이력 */}
          {Object.keys(byMonth).length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">세차 이력이 없습니다</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(byMonth).map(([ym, recs]) => {
                const [yr, mo] = ym.split('-')
                const monthTotal = recs.reduce((sum, r) => sum + r.price, 0)
                return (
                  <div key={ym} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <span className="text-sm font-semibold text-gray-800">
                        {yr}년 {parseInt(mo)}월 — {recs.length}회
                      </span>
                      <span className="text-sm font-bold text-blue-700">{formatPrice(monthTotal)}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {recs.map(r => {
                        const d = new Date(r.wash_date)
                        return (
                          <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                            <div className="flex items-center gap-3">
                              <span className="text-gray-500 w-12">
                                {d.getMonth()+1}/{d.getDate()}
                              </span>
                              <span className="text-gray-700">세차 완료</span>
                              {r.memo && (
                                <span className="text-xs text-gray-400 truncate max-w-[120px]">
                                  {r.memo}
                                </span>
                              )}
                              {r.completed_by === 'admin' && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                                  관리자
                                </span>
                              )}
                              {r.completed_by === 'worker' && (
                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                                  작업자
                                </span>
                              )}
                            </div>
                            <span className="font-medium text-gray-900">{formatPrice(r.price)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
