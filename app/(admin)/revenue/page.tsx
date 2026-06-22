'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, TrendingUp, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import { usePricing } from '@/lib/hooks/usePricing'
import type { Vehicle, Schedule } from '@/types'

type ScheduleWithVehicle = Schedule & {
  vehicle: Vehicle & { customer: { name: string; apartment: string } }
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function RevenuePage() {
  const supabase = createClient()
  const today = new Date()

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [schedules, setSchedules] = useState<ScheduleWithVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const { priceTable } = usePricing()

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data } = await supabase
      .from('schedules')
      .select('*, vehicle:vehicles(*, customer:customers(name, apartment))')
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .eq('is_deleted', false)
      .order('scheduled_date')

    setSchedules((data ?? []) as ScheduleWithVehicle[])
    setLoading(false)
  }, [year, month, supabase])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  function changeMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setSelectedDate(null)
  }

  function formatDateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function schedulePrice(s: ScheduleWithVehicle): number {
    const unitPrice = s.vehicle?.unit_price ?? 0
    const interiorPrice = s.has_interior ? priceTable.interior : 0
    return unitPrice + interiorPrice
  }

  const byDate = useMemo(() => {
    const map: Record<string, ScheduleWithVehicle[]> = {}
    schedules.forEach(s => {
      if (!map[s.scheduled_date]) map[s.scheduled_date] = []
      map[s.scheduled_date].push(s)
    })
    return map
  }, [schedules])

  const revenueByDate = useMemo(() => {
    const map: Record<string, number> = {}
    Object.entries(byDate).forEach(([date, list]) => {
      map[date] = list.reduce((sum, s) => sum + schedulePrice(s), 0)
    })
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDate, priceTable])

  const calendarDays = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay()
    const lastDay = new Date(year, month + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= lastDay; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [year, month])

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const monthlyTotal = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => schedules.reduce((sum, s) => sum + schedulePrice(s), 0),
    [schedules, priceTable]
  )

  const selectedSchedules = useMemo(() => {
    const list = selectedDate ? (byDate[selectedDate] ?? []) : []
    return [...list].sort((a, b) => {
      const aptA = a.vehicle?.customer?.apartment ?? ''
      const aptB = b.vehicle?.customer?.apartment ?? ''
      if (aptA !== aptB) return aptA.localeCompare(aptB, 'ko')
      const unitA = a.vehicle?.unit_number ?? ''
      const unitB = b.vehicle?.unit_number ?? ''
      return unitA.localeCompare(unitB, 'ko')
    })
  }, [selectedDate, byDate])

  const selectedDayTotal = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => selectedSchedules.reduce((sum, s) => sum + schedulePrice(s), 0),
    [selectedSchedules, priceTable]
  )

  // 달력 셀에 표시할 금액 포맷: 135000 → "13.5만" / 80000 → "8만"
  function formatCellAmount(amount: number): string {
    if (amount <= 0) return ''
    const man = amount / 10000
    if (Number.isInteger(man)) return `${man}만`
    return `${man.toFixed(1)}만`
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <span className="text-base font-bold text-gray-900 min-w-[90px] text-center">
              {year}년 {month + 1}월
            </span>
            <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>

          {/* 이달 예상 총매출 */}
          <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
            <TrendingUp size={14} className="text-blue-600" />
            <span className="text-xs text-blue-600 font-medium">이달 예상</span>
            <span className="text-sm font-bold text-blue-900">
              {loading ? '...' : formatPrice(monthlyTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* 캘린더 */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-2xl mx-auto px-2 py-2">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`text-center text-xs font-semibold py-1.5 ${
                  i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="h-[72px]" />

              const dateKey = formatDateKey(day)
              const daySchedules = byDate[dateKey] ?? []
              const count = daySchedules.length
              const revenue = revenueByDate[dateKey] ?? 0
              const isToday = dateKey === todayKey
              const isSelected = dateKey === selectedDate
              const isOvercount = daySchedules.some(s => s.is_overcount)
              const dow = new Date(year, month, day).getDay()

              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                  className={`
                    relative h-[72px] rounded-lg flex flex-col items-center justify-start pt-1.5 transition-colors
                    ${isSelected
                      ? 'bg-blue-600 text-white'
                      : isToday
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'}
                  `}
                >
                  {/* 날짜 숫자 */}
                  <span className={`text-xs font-semibold leading-none ${
                    isSelected ? 'text-white'
                    : isToday   ? 'text-blue-600'
                    : dow === 0 ? 'text-red-400'
                    : dow === 6 ? 'text-blue-400'
                    : 'text-gray-700'
                  }`}>
                    {day}
                  </span>

                  {/* 작업 수 원형 배지 */}
                  {count > 0 && (
                    <span className={`
                      mt-0.5 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none
                      ${isSelected  ? 'bg-white text-blue-600'
                      : isOvercount ? 'bg-orange-100 text-orange-600'
                      : 'bg-blue-100 text-blue-700'}
                    `}>
                      {count}
                    </span>
                  )}

                  {/* 예상 금액 */}
                  {count > 0 && (
                    <span className={`mt-0.5 text-[10px] font-semibold leading-none ${
                      isSelected ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {formatCellAmount(revenue)}
                    </span>
                  )}

                  {/* 초과 경고 아이콘 */}
                  {isOvercount && !isSelected && (
                    <span className="absolute top-0.5 right-0.5">
                      <AlertTriangle size={9} className="text-orange-400" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 하단 요약 */}
          {!loading && (
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>이번달 예정 작업 <span className="font-bold text-gray-700">{schedules.length}대</span></span>
              <span>
                예상 총매출&nbsp;
                <span className="font-bold text-blue-700">{formatPrice(monthlyTotal)}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 선택 날짜 상세 패널 */}
      {selectedDate && (
        <div className="border-t border-gray-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="max-w-2xl mx-auto">
            {/* 패널 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  {month + 1}월 {parseInt(selectedDate.split('-')[2])}일&nbsp;—&nbsp;
                  <span className="text-blue-600">{selectedSchedules.length}대 예정</span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">예정 일정 기준 단가 합산</p>
              </div>
              <div className="flex items-center gap-2">
                {/* 일일 예상 매출 강조 표시 */}
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-right">
                  <p className="text-[10px] text-green-600 font-semibold leading-none mb-1">예상 매출</p>
                  <p className="text-xl font-bold text-green-700 leading-none">{formatPrice(selectedDayTotal)}</p>
                </div>
                <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 차량별 금액 목록 */}
            <div className="max-h-72 overflow-y-auto">
              {selectedSchedules.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">예약 없음</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {selectedSchedules.map(s => {
                    const unitP = s.vehicle?.unit_price ?? 0
                    const interiorP = s.has_interior ? priceTable.interior : 0
                    const total = unitP + interiorP
                    return (
                      <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm text-gray-900">{s.vehicle?.car_name}</span>
                            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {s.vehicle?.plate_number}
                            </span>
                            {s.has_interior && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                                +실내 {formatPrice(interiorP)}
                              </span>
                            )}
                            {s.is_overcount && (
                              <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">
                                초과
                              </span>
                            )}
                          </div>
                          {s.vehicle?.customer?.name && (
                            <p className="text-xs text-gray-400 mt-0.5">{s.vehicle.customer.name}</p>
                          )}
                        </div>
                        <span className="font-semibold text-sm text-gray-900 ml-3 shrink-0">
                          {formatPrice(total)}
                        </span>
                      </div>
                    )
                  })}

                  {/* 합계 행 */}
                  <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-800">합계</span>
                    <span className="text-lg font-bold text-blue-900">{formatPrice(selectedDayTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
