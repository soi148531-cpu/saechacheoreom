'use client'

// Design Ref: §5.5 — 차량 이력 조회 (고객명 or 번호판 검색 → 고객 중심 표시)
// Plan SC: SC-01

import { useState } from 'react'
import { Search, Sofa, User, Car } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CAR_GRADE_LABELS, MONTHLY_COUNT_LABELS } from '@/lib/constants/pricing'
import { formatPrice } from '@/lib/utils'
import type { Customer, Vehicle, WashRecord } from '@/types'

interface VehicleHistory {
  vehicle: Vehicle
  records: WashRecord[]
}

interface HistoryResult {
  customer: Customer
  vehicleHistories: VehicleHistory[]
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

    const q = query.trim()

    // 1. 고객명으로 먼저 검색 → 없으면 번호판으로 검색
    let customerId: string | null = null

    const { data: customerByName } = await supabase
      .from('customers')
      .select('id')
      .ilike('name', `%${q}%`)
      .limit(1)

    if (customerByName && customerByName.length > 0) {
      customerId = customerByName[0].id
    } else {
      // 번호판으로 차량 검색 → customer_id 추출
      const { data: vehicleByPlate } = await supabase
        .from('vehicles')
        .select('customer_id')
        .ilike('plate_number', `%${q}%`)
        .limit(1)

      if (vehicleByPlate && vehicleByPlate.length > 0) {
        customerId = vehicleByPlate[0].customer_id
      }
    }

    if (!customerId) {
      setResult(null)
      setLoading(false)
      return
    }

    // 2. 고객 정보 + 모든 차량 불러오기
    const { data: customerData } = await supabase
      .from('customers')
      .select('*, vehicles(*)')
      .eq('id', customerId)
      .single()

    if (!customerData) {
      setResult(null)
      setLoading(false)
      return
    }

    const customer = customerData as Customer
    const vehicles = (customer.vehicles ?? []) as Vehicle[]

    // 3. 각 차량별 세차 이력 불러오기
    const vehicleHistories: VehicleHistory[] = await Promise.all(
      vehicles.map(async (vehicle) => {
        const { data: records } = await supabase
          .from('wash_records')
          .select('*')
          .eq('vehicle_id', vehicle.id)
          .order('wash_date', { ascending: false })
        return { vehicle, records: (records ?? []) as WashRecord[] }
      })
    )

    setResult({ customer, vehicleHistories })
    setLoading(false)
  }

  // 총 이력 건수 / 금액 합산
  const totalRecords = result?.vehicleHistories.reduce((sum, vh) => sum + vh.records.length, 0) ?? 0
  const totalAmount  = result?.vehicleHistories.reduce(
    (sum, vh) => sum + vh.records.reduce((s, r) => s + r.price, 0), 0
  ) ?? 0

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
            placeholder="고객명 또는 차량번호 입력"
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
          일치하는 고객 또는 차량이 없습니다
        </div>
      )}

      {result && !loading && (
        <div>
          {/* 고객 정보 카드 */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-1">
              <User size={15} className="text-blue-500" />
              <span className="text-lg font-bold text-gray-900">{result.customer.name}</span>
              <span className="text-sm text-gray-500">{result.customer.apartment}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              {result.customer.phone && <span>{result.customer.phone}</span>}
              <span className="flex items-center gap-1">
                <Car size={13} className="text-blue-400" />
                차량 {result.vehicleHistories.length}대
              </span>
              <span>전체 이력 {totalRecords}건 · 총 {formatPrice(totalAmount)}</span>
            </div>
          </div>

          {/* 차량별 이력 */}
          <div className="space-y-5">
            {result.vehicleHistories.map(({ vehicle, records }) => {
              // 월별 그룹핑
              const byMonth: Record<string, WashRecord[]> = {}
              records.forEach(r => {
                const ym = r.wash_date.slice(0, 7)
                if (!byMonth[ym]) byMonth[ym] = []
                byMonth[ym].push(r)
              })

              return (
                <div key={vehicle.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* 차량 헤더 */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{vehicle.car_name}</span>
                      <span className="font-mono text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-blue-700">
                        {vehicle.plate_number}
                      </span>
                      <span className="text-xs text-gray-500">{vehicle.unit_number}</span>
                      <span className="text-xs text-blue-600">
                        {CAR_GRADE_LABELS[vehicle.car_grade]} · {MONTHLY_COUNT_LABELS[vehicle.monthly_count]}
                        {vehicle.unit_price && ` · ${formatPrice(vehicle.unit_price)}/회`}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{records.length}건</span>
                  </div>

                  {/* 이력 없음 */}
                  {records.length === 0 && (
                    <div className="px-4 py-4 text-sm text-gray-400 text-center">세차 이력이 없습니다</div>
                  )}

                  {/* 월별 이력 */}
                  {Object.keys(byMonth).length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {Object.entries(byMonth).map(([ym, recs]) => {
                        const [yr, mo] = ym.split('-')
                        const monthTotal = recs.reduce((sum, r) => sum + r.price, 0)
                        return (
                          <div key={ym}>
                            <div className="flex items-center justify-between px-4 py-2 bg-gray-50/50">
                              <span className="text-xs font-semibold text-gray-600">
                                {yr}년 {parseInt(mo)}월 — {recs.length}회
                              </span>
                              <span className="text-xs font-bold text-blue-700">{formatPrice(monthTotal)}</span>
                            </div>
                            <div className="divide-y divide-gray-50">
                              {recs.map(r => {
                                const d = new Date(r.wash_date)
                                return (
                                  <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-gray-500 w-12">
                                        {d.getMonth()+1}/{d.getDate()}
                                      </span>
                                      <span className="text-gray-700">세차 완료</span>
                                      {vehicle.unit_price && r.price > vehicle.unit_price && (
                                        <span className="flex items-center gap-0.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                                          <Sofa size={10} />
                                          실내
                                        </span>
                                      )}
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
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
