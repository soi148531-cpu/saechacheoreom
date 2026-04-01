'use client'

// Design Ref: §5.2 — 고객 관리 목록 (정기/정지/비정기/미등록 탭)
// Plan SC: SC-01 오시오 기능 대체

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CAR_GRADE_LABELS, MONTHLY_COUNT_LABELS } from '@/lib/constants/pricing'
import { formatPrice } from '@/lib/utils'
import type { Customer, VehicleStatus } from '@/types'

const TABS: { key: VehicleStatus | 'all'; label: string }[] = [
  { key: 'all',          label: '전체' },
  { key: 'active',       label: '정기' },
  { key: 'paused',       label: '정지' },
  { key: 'irregular',    label: '비정기' },
  { key: 'unregistered', label: '미등록' },
]

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<VehicleStatus | 'all'>('all')
  const [search, setSearch]       = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select(`*, vehicles(*)`)
      .order('created_at', { ascending: false })

    if (!error && data) setCustomers(data as Customer[])
    setLoading(false)
  }

  // 탭 + 검색 필터
  const filtered = customers.filter(c => {
    const vehicles = c.vehicles ?? []

    // 검색어 필터
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

    // 탭 필터
    if (activeTab === 'all') return true
    if (activeTab === 'unregistered') return vehicles.length === 0
    return vehicles.some(v => v.status === activeTab)
  })

  // 탭별 카운트
  const counts = {
    all:          customers.length,
    active:       customers.filter(c => c.vehicles?.some(v => v.status === 'active')).length,
    paused:       customers.filter(c => c.vehicles?.some(v => v.status === 'paused')).length,
    irregular:    customers.filter(c => c.vehicles?.some(v => v.status === 'irregular')).length,
    unregistered: customers.filter(c => !c.vehicles || c.vehicles.length === 0).length,
  }

  // 이번달 신규/이탈 카운트
  const thisMonth = (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })()
  const allVehicles = customers.flatMap(c => c.vehicles ?? [])
  const newThisMonth  = allVehicles.filter(v => v.start_date?.startsWith(thisMonth)).length
  const exitThisMonth = allVehicles.filter(v => v.end_date?.startsWith(thisMonth)).length

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-900">고객 관리</h1>
        <div className="flex gap-2">
          <Link
            href="/customers/legacy"
            className="flex items-center gap-1 bg-amber-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            ◆ 기존 고객
          </Link>
          <Link
            href="/customers/new"
            className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            신규 등록
          </Link>
        </div>
      </div>

      {/* 이번달 신규/이탈 */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-blue-500 font-medium">이번달 신규</p>
          <p className="text-lg font-bold text-blue-700">{newThisMonth}대</p>
        </div>
        <div className="flex-1 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-red-400 font-medium">이번달 이탈</p>
          <p className="text-lg font-bold text-red-600">{exitThisMonth}대</p>
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
                        <span className="text-xs text-gray-400">{v.unit_number}</span>
                        <span className="text-xs text-blue-600">
                          {CAR_GRADE_LABELS[v.car_grade]} · {MONTHLY_COUNT_LABELS[v.monthly_count]}
                        </span>
                        {v.unit_price && (
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
