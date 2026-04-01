'use client'

// Design Ref: 통계 대시보드 — 월별 정기/정지/비정기 추이 + 매출 조회

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import type { Vehicle } from '@/types'

// ────────────────────────────── helpers ──────────────────────────────

function padMonth(n: number) {
  return String(n + 1).padStart(2, '0')
}

function lastDayOf(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstOfMonth(year: number, month: number) {
  return `${year}-${padMonth(month)}-01`
}

function lastOfMonth(year: number, month: number) {
  return `${year}-${padMonth(month)}-${String(lastDayOf(year, month)).padStart(2, '0')}`
}

function ymStr(year: number, month: number) {
  return `${year}-${padMonth(month)}`
}

// 해당 월에 활성인 차량 분류
function classifyForMonth(vehicles: Vehicle[], year: number, month: number) {
  const first = firstOfMonth(year, month)
  const last  = lastOfMonth(year, month)

  const active:    Vehicle[] = []
  const paused:    Vehicle[] = []
  const irregular: Vehicle[] = []

  for (const v of vehicles) {
    if (v.start_date > last) continue                          // 아직 시작 전
    if (v.end_date && v.end_date < first) continue            // 이미 종료

    if (v.monthly_count === 'onetime') {
      irregular.push(v)
    } else if (v.status === 'paused') {
      paused.push(v)
    } else {
      active.push(v)
    }
  }

  return { active, paused, irregular }
}

// 해당 월 신규(start)/이탈(end) 카운트
function monthlyDelta(vehicles: Vehicle[], year: number, month: number) {
  const ym = ymStr(year, month)
  const newCount  = vehicles.filter(v => v.start_date?.startsWith(ym)).length
  const exitCount = vehicles.filter(v => v.end_date?.startsWith(ym)).length
  return { newCount, exitCount }
}

// 월 매출 계산 (정기 차량 × monthly_price)
function monthlyRevenue(actives: Vehicle[]) {
  return actives.reduce((sum, v) => sum + (v.monthly_price ?? 0), 0)
}

// ────────────────────────────── chart ──────────────────────────────

interface ChartData {
  label: string
  active:    number
  paused:    number
  irregular: number
}

function TrendChart({ data }: { data: ChartData[] }) {
  const maxVal = Math.max(...data.map(d => d.active + d.paused + d.irregular), 1)

  return (
    <div className="mt-2">
      <div className="flex items-end gap-1 h-28">
        {data.map((d) => {
          const total   = d.active + d.paused + d.irregular
          const totalH  = Math.round((total / maxVal) * 100)
          const activeH = total > 0 ? Math.round((d.active    / total) * totalH) : 0
          const pausedH = total > 0 ? Math.round((d.paused    / total) * totalH) : 0
          const irregH  = total > 0 ? Math.round((d.irregular / total) * totalH) : 0

          return (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-500 font-medium">{total}</span>
              <div className="w-full flex flex-col-reverse rounded-sm overflow-hidden" style={{ height: `${Math.max(totalH, 2)}%` }}>
                <div className="w-full bg-blue-500"   style={{ flex: activeH }} />
                <div className="w-full bg-orange-400" style={{ flex: pausedH }} />
                <div className="w-full bg-purple-400" style={{ flex: irregH  }} />
              </div>
              <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.label}</span>
            </div>
          )
        })}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-3 mt-2 px-1">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-xs text-gray-600">정기</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-orange-400" />
          <span className="text-xs text-gray-600">정지</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-purple-400" />
          <span className="text-xs text-gray-600">비정기</span>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────── page ──────────────────────────────

export default function StatsPage() {
  const supabase = createClient()

  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading]   = useState(true)

  const fetchVehicles = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: true })
    if (data) setVehicles(data as Vehicle[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchVehicles()
  }, [fetchVehicles])

  // 현재 월 분류
  const { active, paused, irregular } = classifyForMonth(vehicles, year, month)
  const { newCount, exitCount } = monthlyDelta(vehicles, year, month)
  const revenue = monthlyRevenue(active)

  // 최근 6개월 추이 (현재 월 포함)
  const chartData: ChartData[] = Array.from({ length: 6 }, (_, i) => {
    const offset = i - 5  // -5, -4, ..., 0
    let m = month + offset
    let y = year
    while (m < 0) { m += 12; y -= 1 }
    while (m > 11) { m -= 12; y += 1 }

    const cls = classifyForMonth(vehicles, y, m)
    const isCurrentYear = y === year
    const shortLabel = isCurrentYear
      ? `${m + 1}월`
      : `${y % 100}-${m + 1}`

    return {
      label:     shortLabel,
      active:    cls.active.length,
      paused:    cls.paused.length,
      irregular: cls.irregular.length,
    }
  })

  // 이전/다음 월 이동
  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const MONTHS_KR = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {/* 헤더 + 월 네비게이션 */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">통계</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-gray-800 min-w-[90px] text-center">
            {year}년 {MONTHS_KR[month]}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
          데이터 불러오는 중...
        </div>
      ) : (
        <>
          {/* 차량 현황 카드 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium mb-3">
              {year}년 {MONTHS_KR[month]} 차량 현황
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg px-3 py-3 text-center">
                <p className="text-lg font-bold text-blue-700">{active.length}대</p>
                <p className="text-xs text-blue-500 mt-0.5">정기</p>
              </div>
              <div className="bg-orange-50 rounded-lg px-3 py-3 text-center">
                <p className="text-lg font-bold text-orange-600">{paused.length}대</p>
                <p className="text-xs text-orange-500 mt-0.5">정지</p>
              </div>
              <div className="bg-purple-50 rounded-lg px-3 py-3 text-center">
                <p className="text-lg font-bold text-purple-600">{irregular.length}대</p>
                <p className="text-xs text-purple-500 mt-0.5">비정기</p>
              </div>
            </div>
          </div>

          {/* 신규 / 이탈 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={18} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">이번달 신규</p>
                <p className="text-xl font-bold text-green-600">+{newCount}대</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <TrendingDown size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">이번달 이탈</p>
                <p className="text-xl font-bold text-red-500">-{exitCount}대</p>
              </div>
            </div>
          </div>

          {/* 월 매출 (정기 기준) */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium mb-1">월 예상 매출 (정기 기준)</p>
            <p className="text-2xl font-bold text-gray-900">
              {revenue > 0 ? `₩${formatPrice(revenue)}` : '—'}
            </p>
            {active.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                정기 {active.length}대 합산 · 대당 평균 ₩{formatPrice(Math.round(revenue / active.length))}
              </p>
            )}
          </div>

          {/* 6개월 추이 그래프 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium mb-2">최근 6개월 추이</p>
            <TrendChart data={chartData} />
          </div>
        </>
      )}
    </div>
  )
}
