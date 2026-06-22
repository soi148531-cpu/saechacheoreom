'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CAR_GRADE_LABELS, MONTHLY_COUNT_LABELS } from '@/lib/constants/pricing'
import { formatPrice } from '@/lib/utils'
import type { Customer, VehicleStatus } from '@/types'

const TABS: { key: VehicleStatus | 'all'; label: string }[] = [
  { key: 'all',          label: '전체' },
  { key: 'active',       label: '정기' },
  { key: 'pending',      label: '등록대기' },
  { key: 'paused',       label: '정지' },
  { key: 'irregular',    label: '비정기' },
  { key: 'unregistered', label: '미등록' },
]

const MONTHLY_COUNT_NUM: Record<string, number> = {
  monthly_1: 1,
  monthly_2: 2,
  monthly_4: 4,
}

function toYM(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatYM(ym: string) {
  const [y, m] = ym.split('-')
  return `${y}년 ${Number(m)}월`
}

function formatDay(dateStr: string | null | undefined) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<VehicleStatus | 'all'>('all')
  const [search, setSearch]       = useState('')
  const supabase = createClient()

  const todayYM = toYM(new Date())
  const [viewMonth, setViewMonth]   = useState(todayYM)
  const [showNewList, setShowNewList]   = useState(false)
  const [showExitList, setShowExitList] = useState(false)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select(`*, vehicles(*)`)
      .order('created_at', { ascending: false })
    if (!error && data) setCustomers(data as Customer[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  // 탭 + 검색 필터
  const filtered = customers.filter(c => {
    const vehicles = c.vehicles ?? []
    const q = search.toLowerCase()
    if (q) {
      const match =
        c.name.toLowerCase().includes(q) ||
        c.apartment.toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q) ||
        vehicles.some(v =>
          v.plate_number.toLowerCase().includes(q) ||
          v.car_name.toLowerCase().includes(q)
        )
      if (!match) return false
    }
    if (activeTab === 'all') return true
    if (activeTab === 'unregistered') return vehicles.length === 0 || vehicles.some(v => v.status === 'unregistered')
    return vehicles.some(v => v.status === activeTab)
  })

  const allVehicles = customers.flatMap(c => c.vehicles ?? [])
  const counts = {
    all:          customers.length,
    active:       allVehicles.filter(v => v.status === 'active').length,
    pending:      allVehicles.filter(v => v.status === 'pending').length,
    paused:       allVehicles.filter(v => v.status === 'paused').length,
    irregular:    allVehicles.filter(v => v.status === 'irregular').length,
    unregistered: customers.filter(c => !c.vehicles || c.vehicles.length === 0 || c.vehicles.some(v => v.status === 'unregistered')).length,
  }

  // 월별 신규/이탈
  const vehicleWithCustomer = (vId: string) =>
    customers.find(c => c.vehicles?.some(v => v.id === vId))

  const newVehicles  = allVehicles.filter(v => v.start_date?.startsWith(viewMonth))
  const exitVehicles = allVehicles.filter(v => v.end_date?.startsWith(viewMonth))

  // 월 이동
  const [vy, vm] = viewMonth.split('-').map(Number)
  const goPrev = () => {
    const d = new Date(vy, vm - 2, 1)
    setViewMonth(toYM(d))
    setShowNewList(false); setShowExitList(false)
  }
  const goNext = () => {
    if (viewMonth >= todayYM) return
    const d = new Date(vy, vm, 1)
    setViewMonth(toYM(d))
    setShowNewList(false); setShowExitList(false)
  }

  // 월 예상 매출 (정기 active 차량 외부 + 실내)
  const monthlyRevenue = allVehicles
    .filter(v => v.status === 'active')
    .reduce((sum, v) => {
      const count = MONTHLY_COUNT_NUM[v.monthly_count] ?? 0
      const exteriorRevenue = (v.unit_price ?? 0) * count
      const interiorRevenue = (v.interior_count ?? 0) * 10000
      return sum + exteriorRevenue + interiorRevenue
    }, 0)

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-900">고객 관리</h1>
        <Link
          href="/customers/new"
          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          고객 등록
        </Link>
      </div>

      {/* 월별 변동 현황 */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={goPrev}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-bold text-gray-700">{formatYM(viewMonth)} 변동 현황</span>
          <button
            onClick={goNext}
            disabled={viewMonth >= todayYM}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* 신규/이탈 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={() => { setShowNewList(p => !p); setShowExitList(false) }}
            className="flex-1 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-center"
          >
            <p className="text-xs text-blue-500 font-medium">신규 등록</p>
            <p className="text-base font-bold text-blue-700 flex items-center justify-center gap-1">
              {newVehicles.length}대
              {showNewList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </p>
          </button>
          <button
            onClick={() => { setShowExitList(p => !p); setShowNewList(false) }}
            className="flex-1 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-center"
          >
            <p className="text-xs text-red-400 font-medium">이탈(정지)</p>
            <p className="text-base font-bold text-red-600 flex items-center justify-center gap-1">
              {exitVehicles.length}대
              {showExitList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </p>
          </button>
        </div>

        {/* 신규 목록 */}
        {showNewList && (
          <div className="mt-2 border-t border-gray-100 pt-2 space-y-1">
            {newVehicles.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-1">신규 등록 차량 없음</p>
            ) : newVehicles.map(v => {
              const c = vehicleWithCustomer(v.id)
              return (
                <div key={v.id} className="flex items-center justify-between text-xs text-gray-700 bg-blue-50 rounded px-2 py-1">
                  <span>
                    <span className="font-semibold">{c?.name}</span>
                    <span className="text-gray-400 ml-1">{c?.apartment}</span>
                    <span className="ml-1 font-mono text-gray-500">{v.plate_number}</span>
                    <span className="ml-1">{v.car_name}</span>
                  </span>
                  <span className="text-blue-500 font-medium ml-2 whitespace-nowrap">{formatDay(v.start_date)}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* 이탈 목록 */}
        {showExitList && (
          <div className="mt-2 border-t border-gray-100 pt-2 space-y-1">
            {exitVehicles.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-1">이탈 차량 없음</p>
            ) : exitVehicles.map(v => {
              const c = vehicleWithCustomer(v.id)
              return (
                <div key={v.id} className="flex items-center justify-between text-xs text-gray-700 bg-red-50 rounded px-2 py-1">
                  <span>
                    <span className="font-semibold">{c?.name}</span>
                    <span className="text-gray-400 ml-1">{c?.apartment}</span>
                    <span className="ml-1 font-mono text-gray-500">{v.plate_number}</span>
                    <span className="ml-1">{v.car_name}</span>
                  </span>
                  <span className="text-red-500 font-medium ml-2 whitespace-nowrap">{formatDay(v.end_date)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 요약 + 월 예상 매출 */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-3">
        <div className="flex gap-3 text-sm">
          <span className="text-gray-500">고객 <span className="font-bold text-gray-800">{customers.length}명</span></span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">정기 <span className="font-bold text-blue-600">{counts.active}대</span></span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">정지 <span className="font-bold text-gray-600">{counts.paused}대</span></span>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">월 예상 매출</p>
          <p className="text-sm font-bold text-green-600">{formatPrice(monthlyRevenue)}원</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {label} {counts[key]}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="고객명, 차량번호, 아파트 검색"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">등록된 고객이 없습니다</p>
          <Link href="/customers/new" className="text-blue-600 text-sm mt-2 inline-block">
            + 첫 고객 등록하기
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(customer => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{customer.name}</span>
                    <span className="text-xs text-gray-400">{customer.apartment}</span>
                  </div>
                  {customer.vehicles && customer.vehicles.length > 0 ? (
                    customer.vehicles.map(v => (
                      <div key={v.id} className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <span className="font-medium text-gray-800">{v.car_name}</span>
                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          {v.plate_number}
                        </span>
                        {v.status === 'pending' ? (
                          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                            등록대기
                          </span>
                        ) : (
                          <span className="text-xs text-blue-600">
                            {CAR_GRADE_LABELS[v.car_grade]} · {MONTHLY_COUNT_LABELS[v.monthly_count]}
                          </span>
                        )}
                        {v.unit_price && v.status !== 'pending' && (
                          <span className="text-xs text-gray-500">
                            {formatPrice(v.unit_price)}/회
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-orange-500">차량 미등록</span>
                  )}
                </div>
                <ChevronRight size={18} className="text-gray-300 flex-shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
