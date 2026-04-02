'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Settings, X, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import type { WashRecord, Vehicle, Customer, Schedule } from '@/types'

type PayrollRecord = WashRecord & {
  vehicle: Vehicle & { customer: Customer }
  schedule: (Schedule & { has_interior: boolean }) | null
}

function padMonth(n: number) { return String(n + 1).padStart(2, '0') }
const MONTHS_KR = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const RATE_KEY = 'payroll_rates_v1'

interface Rates {
  exterior: number   // 실외 세차 건당
  interior: number   // 실내 세차 건당 (추가분)
  extra: number      // 기타 추가 금액
}

function loadRates(): Rates {
  if (typeof window === 'undefined') return { exterior: 3000, interior: 5000, extra: 0 }
  try {
    const raw = localStorage.getItem(RATE_KEY)
    if (raw) return JSON.parse(raw) as Rates
  } catch {}
  return { exterior: 3000, interior: 5000, extra: 0 }
}

export default function PayrollPage() {
  const supabase = createClient()
  const today = new Date()

  const [year,         setYear]         = useState(today.getFullYear())
  const [month,        setMonth]        = useState(today.getMonth())
  const [records,      setRecords]      = useState<PayrollRecord[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [rates,        setRates]        = useState<Rates>({ exterior: 3000, interior: 5000, extra: 0 })
  const [draftRates,   setDraftRates]   = useState<Rates>({ exterior: 3000, interior: 5000, extra: 0 })

  // 클라이언트에서만 localStorage 로드
  useEffect(() => {
    const r = loadRates()
    setRates(r)
    setDraftRates(r)
  }, [])

  const ymPrefix = `${year}-${padMonth(month)}`

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('wash_records')
      .select('*, vehicle:vehicles(*, customer:customers(*)), schedule:schedules(id, has_interior, scheduled_date)')
      .gte('wash_date', `${ymPrefix}-01`)
      .lte('wash_date', `${ymPrefix}-31`)
      .eq('is_completed', true)
      .eq('completed_by', 'worker')
      .order('wash_date', { ascending: true })
    if (data) setRecords(data as PayrollRecord[])
    setLoading(false)
  }, [supabase, ymPrefix])

  useEffect(() => { fetchData() }, [fetchData])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function saveRates() {
    setRates(draftRates)
    localStorage.setItem(RATE_KEY, JSON.stringify(draftRates))
    setShowSettings(false)
  }

  // 실내 여부 판단: schedule.has_interior = true 이고 price > vehicle.unit_price
  function hasInterior(r: PayrollRecord): boolean {
    const unitPrice = r.vehicle?.unit_price ?? 0
    const scheduleHasInterior = r.schedule?.has_interior ?? false
    return scheduleHasInterior && r.price > unitPrice
  }

  const exteriorCount = records.filter(r => !hasInterior(r)).length
  const interiorCount = records.filter(r => hasInterior(r)).length
  const exteriorPay   = exteriorCount * rates.exterior
  const interiorPay   = interiorCount * rates.interior
  const totalPay      = exteriorPay + interiorPay + rates.extra

  // 날짜별 그룹핑
  const byDate: Record<string, PayrollRecord[]> = {}
  for (const r of records) {
    if (!byDate[r.wash_date]) byDate[r.wash_date] = []
    byDate[r.wash_date].push(r)
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">작업자 정산</h1>
          <p className="text-xs text-gray-400 mt-0.5">직원 완료 기준 (관리자 직접완료 제외)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setDraftRates(rates); setShowSettings(true) }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            title="단가 설정"
          >
            <Settings size={20} />
          </button>
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
      </div>

      {/* 단가 설정 모달 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">단가 설정</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 font-medium block mb-1">실외 세차 단가 (원/건)</label>
                <input
                  type="number"
                  value={draftRates.exterior}
                  onChange={e => setDraftRates(r => ({ ...r, exterior: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={0}
                  step={500}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 font-medium block mb-1">실내 세차 추가 단가 (원/건)</label>
                <input
                  type="number"
                  value={draftRates.interior}
                  onChange={e => setDraftRates(r => ({ ...r, interior: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={0}
                  step={500}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 font-medium block mb-1">기타 추가 금액 (원)</label>
                <input
                  type="number"
                  value={draftRates.extra}
                  onChange={e => setDraftRates(r => ({ ...r, extra: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={0}
                  step={1000}
                />
              </div>
            </div>
            <button
              onClick={saveRates}
              className="mt-5 w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <Save size={16} />
              저장
            </button>
          </div>
        </div>
      )}

      {/* 정산 요약 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">이번 달 정산 ({MONTHS_KR[month]})</p>
        <div className="space-y-2 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              실외 세차 <span className="font-semibold text-gray-900">{exteriorCount}건</span>
              <span className="text-xs text-gray-400 ml-1"> {formatPrice(rates.exterior)}원</span>
            </span>
            <span className="text-sm font-semibold text-gray-900">{formatPrice(exteriorPay)}원</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              실내 세차 <span className="font-semibold text-gray-900">{interiorCount}건</span>
              <span className="text-xs text-gray-400 ml-1"> {formatPrice(rates.interior)}원</span>
            </span>
            <span className="text-sm font-semibold text-gray-900">{formatPrice(interiorPay)}원</span>
          </div>
          {rates.extra > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">기타 추가</span>
              <span className="text-sm font-semibold text-gray-900">{formatPrice(rates.extra)}원</span>
            </div>
          )}
        </div>
        <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
          <span className="text-sm font-bold text-gray-700">총 인건비</span>
          <span className="text-2xl font-bold text-blue-600">{formatPrice(totalPay)}원</span>
        </div>
        <div className="mt-2 bg-gray-50 rounded-lg p-2 text-xs text-gray-500 text-center">
          총 작업 {records.length}건 (실외 {exteriorCount} + 실내 {interiorCount})
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">데이터 불러오는 중...</div>
      ) : records.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">이 달의 직원 완료 작업이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => {
            const dayExt = rows.filter(r => !hasInterior(r)).length
            const dayInt = rows.filter(r => hasInterior(r)).length
            return (
              <div key={date} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">{date}</span>
                  <span className="text-xs text-gray-500">
                    총 {rows.length}건
                    {dayInt > 0 && <span className="ml-1 text-purple-600">(실내 {dayInt}건)</span>}
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {rows.map(r => {
                    const interior = hasInterior(r)
                    const customer = r.vehicle?.customer
                    return (
                      <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {customer?.name ?? '-'}
                            {r.vehicle?.unit_number && (
                              <span className="text-gray-400 text-xs ml-1">({r.vehicle.unit_number}호)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">{r.vehicle?.plate_number}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {interior && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                              실내포함
                            </span>
                          )}
                          <div className="text-right">
                            <p className="text-xs text-gray-500">세차비 {formatPrice(r.price)}원</p>
                            <p className="text-sm font-semibold text-blue-600">
                              +{formatPrice((interior ? rates.exterior + rates.interior : rates.exterior))}원
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* 일별 소계 */}
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex justify-between">
                  <span className="text-xs text-blue-700 font-medium">일별 인건비</span>
                  <span className="text-xs font-bold text-blue-800">
                    {formatPrice(dayExt * rates.exterior + dayInt * (rates.exterior + rates.interior))}원
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}