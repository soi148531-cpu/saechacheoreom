'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import type { Vehicle, WashRecord } from '@/types'

type ViewMode = 'daily' | 'weekly' | 'monthly'

function padMonth(n: number) { return String(n + 1).padStart(2, '0') }
function lastDayOf(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function ymPrefix(year: number, month: number) { return `${year}-${padMonth(month)}` }

function classifyForMonth(vehicles: Vehicle[], year: number, month: number) {
  const first = `${ymPrefix(year, month)}-01`
  const last  = `${ymPrefix(year, month)}-${String(lastDayOf(year, month)).padStart(2, '0')}`
  const active: Vehicle[] = [], paused: Vehicle[] = [], irregular: Vehicle[] = []
  for (const v of vehicles) {
    if (v.start_date > last) continue
    if (v.end_date && v.end_date < first) continue
    if (v.monthly_count === 'onetime') irregular.push(v)
    else if (v.status === 'paused') paused.push(v)
    else active.push(v)
  }
  return { active, paused, irregular }
}

function monthlyDelta(vehicles: Vehicle[], year: number, month: number) {
  const prefix = ymPrefix(year, month)
  return {
    newCount:  vehicles.filter(v => v.start_date?.startsWith(prefix)).length,
    // 이탈 = end_date 있는 차량 기준 (서비스 정지(paused) 제외)
    exitCount: vehicles.filter(v => v.end_date?.startsWith(prefix) && v.status !== 'paused').length,
  }
}

interface Bar { label: string; count: number; revenue: number }

function BarChart({ data }: { data: Bar[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const showEvery = data.length > 15 ? 5 : data.length > 8 ? 2 : 1
  return (
    <div>
      <div className="flex items-end gap-0.5 h-36">
        {data.map((d, i) => {
          const pct = Math.round((d.count / maxCount) * 100)
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end"
              style={{ height: '100%' }}
              title={`${d.label}: ${d.count}건 / ${formatPrice(d.revenue)}`}
            >
              <div
                className={`w-full rounded-t-sm transition-all ${d.count > 0 ? 'bg-orange-300 hover:bg-orange-400' : 'bg-gray-100'}`}
                style={{ height: `${Math.max(pct, 3)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-0.5 mt-1 border-t border-gray-100 pt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center overflow-hidden">
            <span className="text-[9px] text-gray-400 leading-none">{i % showEvery === 0 ? d.label : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const MONTHS_KR = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

export default function StatsPage() {
  const supabase = createClient()
  const today = new Date()

  const [year,        setYear]        = useState(today.getFullYear())
  const [month,       setMonth]       = useState(today.getMonth())
  const [view,        setView]        = useState<ViewMode>('monthly')
  const [vehicles,    setVehicles]    = useState<Vehicle[]>([])
  const [washRecords, setWashRecords] = useState<WashRecord[]>([])
  const [loading,     setLoading]     = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [vRes, rRes] = await Promise.all([
      supabase.from('vehicles').select('*'),
      supabase.from('wash_records')
        .select('*')
        .gte('wash_date', `${year}-01-01`)
        .lte('wash_date', `${year}-12-31`)
        .eq('is_completed', true),
    ])
    if (vRes.data)  setVehicles(vRes.data as Vehicle[])
    if (rRes.data)  setWashRecords(rRes.data as WashRecord[])
    setLoading(false)
  }, [supabase, year])

  useEffect(() => { fetchData() }, [fetchData])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const monthRecords = useMemo(
    () => washRecords.filter(r => r.wash_date.startsWith(ymPrefix(year, month))),
    [washRecords, year, month]
  )

  const chartData: Bar[] = useMemo(() => {
    if (view === 'monthly') {
      return Array.from({ length: 12 }, (_, m) => {
        const prefix = ymPrefix(year, m)
        const recs = washRecords.filter(r => r.wash_date.startsWith(prefix))
        return { label: `${m + 1}월`, count: recs.length, revenue: recs.reduce((s, r) => s + r.price, 0) }
      })
    }
    if (view === 'weekly') {
      const ld = lastDayOf(year, month)
      return [
        { label: '1주', s: 1, e: 7 }, { label: '2주', s: 8, e: 14 },
        { label: '3주', s: 15, e: 21 }, { label: '4주', s: 22, e: 28 },
        { label: '5주', s: 29, e: ld },
      ].filter(w => w.s <= ld).map(w => {
        const recs = monthRecords.filter(r => { const d = parseInt(r.wash_date.slice(8)); return d >= w.s && d <= w.e })
        return { label: w.label, count: recs.length, revenue: recs.reduce((s, r) => s + r.price, 0) }
      })
    }
    return Array.from({ length: lastDayOf(year, month) }, (_, i) => {
      const dateStr = `${ymPrefix(year, month)}-${String(i + 1).padStart(2, '0')}`
      const recs = monthRecords.filter(r => r.wash_date === dateStr)
      return { label: `${i + 1}`, count: recs.length, revenue: recs.reduce((s, r) => s + r.price, 0) }
    })
  }, [view, year, month, washRecords, monthRecords])

  const periodRecords = view === 'monthly' ? washRecords : monthRecords
  const totalRevenue  = periodRecords.reduce((s, r) => s + r.price, 0)
  const totalCount    = periodRecords.length
  const avgPerWash    = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0

  const { active, paused, irregular } = classifyForMonth(vehicles, year, month)
  const { newCount, exitCount } = monthlyDelta(vehicles, year, month)
  const expectedRevenue = active.reduce((s, v) => s + (v.monthly_price ?? 0), 0)
  const monthActual = monthRecords.reduce((s, r) => s + r.price, 0)
  const achieveRate = expectedRevenue > 0 ? Math.round((monthActual / expectedRevenue) * 100) : 0

  const periodLabel = view === 'monthly' ? `${year}년` : `${year}년 ${MONTHS_KR[month]}`

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {/* 헤더 + 월 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">통계</h1>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-gray-800 min-w-[90px] text-center">
            {year}년 {MONTHS_KR[month]}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 일간 / 주간 / 월간 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
        {(['daily', 'weekly', 'monthly'] as ViewMode[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {v === 'daily' ? '일간' : v === 'weekly' ? '주간' : '월간'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">데이터 불러오는 중...</div>
      ) : (
        <>
          {/* 차트 + 매출 분석 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div className="md:col-span-3 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">세차 건수</p>
                <p className="text-xs text-gray-400">{periodLabel}</p>
              </div>
              <BarChart data={chartData} />
            </div>

            <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">매출 지표</p>
              <div>
                <p className="text-xs text-gray-400">매출 합계</p>
                <p className="text-lg font-bold text-gray-900">{formatPrice(totalRevenue)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400">세차 건수</p>
                  <p className="text-base font-bold text-gray-800">{totalCount}건</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400">건당 평균</p>
                  <p className="text-base font-bold text-gray-800">{formatPrice(avgPerWash)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-xs text-green-600">신규 차량</p>
                  <p className="text-base font-bold text-green-700 flex items-center gap-1">
                    <TrendingUp size={14} />{newCount}대
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <p className="text-xs text-red-500">이탈 차량</p>
                  <p className="text-base font-bold text-red-600 flex items-center gap-1">
                    <TrendingDown size={14} />{exitCount}대
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 차량 현황 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">차량 현황 ({MONTHS_KR[month]})</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">정기</p>
                <p className="text-2xl font-bold text-blue-700">{active.length}</p>
                <p className="text-xs text-blue-400">대</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <p className="text-xs text-yellow-600 mb-1">정지</p>
                <p className="text-2xl font-bold text-yellow-700">{paused.length}</p>
                <p className="text-xs text-yellow-400">대</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">비정기</p>
                <p className="text-2xl font-bold text-gray-700">{irregular.length}</p>
                <p className="text-xs text-gray-400">대</p>
              </div>
            </div>
          </div>

          {/* 예상 매출 vs 실제 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">예상 vs 실제 ({MONTHS_KR[month]})</p>
            <div className="flex items-end justify-between mb-2">
              <span className="text-xs text-gray-400">달성률</span>
              <span className="text-xl font-bold text-gray-900">{achieveRate}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
              <div
                className={`h-2 rounded-full transition-all ${achieveRate >= 100 ? 'bg-green-400' : achieveRate >= 70 ? 'bg-blue-400' : 'bg-orange-400'}`}
                style={{ width: `${Math.min(achieveRate, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">예상 매출</p>
                <p className="font-semibold text-gray-700">{formatPrice(expectedRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">실제 매출</p>
                <p className="font-semibold text-gray-700">{formatPrice(monthActual)}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}