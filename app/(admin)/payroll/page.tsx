'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Settings, X, Save, Trash2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import type { WashRecord, Vehicle, Customer, Schedule } from '@/types'

type PayrollRecord = WashRecord & {
  vehicle: Vehicle & { customer: Customer }
  schedule: (Schedule & { has_interior: boolean }) | null
}

interface BonusItem {
  id: string
  date: string
  description: string
  amount: number
}

function padMonth(n: number) { return String(n + 1).padStart(2, '0') }
const MONTHS_KR = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const RATE_KEY = 'payroll_rates_v2'
const BONUS_KEY = 'payroll_bonus_v2'

interface Rates {
  exterior: number   // 실외 세차 (세차만) 건당
  interior: number   // 실내 세차 (세차+클리닝) 추가 건당
}

function loadRates(): Rates {
  if (typeof window === 'undefined') return { exterior: 3000, interior: 5000 }
  try {
    const raw = localStorage.getItem(RATE_KEY)
    if (raw) return JSON.parse(raw) as Rates
  } catch {}
  return { exterior: 3000, interior: 5000 }
}

function loadBonus(yearMonth: string): BonusItem[] {
  if (typeof window === 'undefined') return []
  try {
    const key = `${BONUS_KEY}:${yearMonth}`
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as BonusItem[]
  } catch {}
  return []
}

function saveBonus(yearMonth: string, items: BonusItem[]) {
  if (typeof window === 'undefined') return
  const key = `${BONUS_KEY}:${yearMonth}`
  localStorage.setItem(key, JSON.stringify(items))
}

export default function PayrollPage() {
  const supabase = createClient()
  const today = new Date()

  const [year,           setYear]           = useState(today.getFullYear())
  const [month,          setMonth]          = useState(today.getMonth())
  const [records,        setRecords]        = useState<PayrollRecord[]>([])
  const [loading,        setLoading]        = useState(true)
  const [showSettings,   setShowSettings]   = useState(false)
  const [rates,          setRates]          = useState<Rates>({ exterior: 3000, interior: 5000 })
  const [draftRates,     setDraftRates]     = useState<Rates>({ exterior: 3000, interior: 5000 })
  const [bonusItems,     setBonusItems]     = useState<BonusItem[]>([])
  const [showAddBonus,   setShowAddBonus]   = useState(false)
  const [newBonusDate,   setNewBonusDate]   = useState('')
  const [newBonusDesc,   setNewBonusDesc]   = useState('')
  const [newBonusAmount, setNewBonusAmount] = useState('')

  // 클라이언트에서만 localStorage 로드
  useEffect(() => {
    const r = loadRates()
    setRates(r)
    setDraftRates(r)
  }, [])

  const ymPrefix = `${year}-${padMonth(month)}`
  const ymKey = `${year}-${padMonth(month)}`

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

  // 월 변경 시 해당 월의 보너스 항목 불러오기
  useEffect(() => {
    const bonus = loadBonus(ymKey)
    setBonusItems(bonus)
    setShowAddBonus(false)
  }, [ymKey])

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

  function addBonus() {
    if (!newBonusDate || !newBonusDesc || !newBonusAmount) return
    const newItem: BonusItem = {
      id: `${Date.now()}`,
      date: newBonusDate,
      description: newBonusDesc,
      amount: Number(newBonusAmount),
    }
    const updated = [...bonusItems, newItem]
    setBonusItems(updated)
    saveBonus(ymKey, updated)
    setNewBonusDate('')
    setNewBonusDesc('')
    setNewBonusAmount('')
  }

  function deleteBonus(id: string) {
    const updated = bonusItems.filter(b => b.id !== id)
    setBonusItems(updated)
    saveBonus(ymKey, updated)
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
  const bonusTotal    = bonusItems.reduce((s, b) => s + b.amount, 0)
  const totalPay      = exteriorPay + interiorPay + bonusTotal

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
                <label className="text-sm text-gray-600 font-medium block mb-2">
                  실외 세차 (세차만) 단가
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={draftRates.exterior}
                    onChange={e => setDraftRates(r => ({ ...r, exterior: Number(e.target.value) }))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={0}
                    step={500}
                  />
                  <span className="text-sm text-gray-500">원/건</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">기본 세차 작업비용</p>
              </div>
              <div>
                <label className="text-sm text-gray-600 font-medium block mb-2">
                  실내 세차 추가 단가
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={draftRates.interior}
                    onChange={e => setDraftRates(r => ({ ...r, interior: Number(e.target.value) }))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={0}
                    step={500}
                  />
                  <span className="text-sm text-gray-500">원/건</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">실내 청소/클리닝 추가 작업비용</p>
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

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">데이터 불러오는 중...</div>
      ) : (
        <>
          {/* 정산 요약 카드 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">이번 달 정산 ({MONTHS_KR[month]})</p>
            <div className="space-y-2 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  실외 세차 <span className="font-semibold text-gray-900">{exteriorCount}건</span>
                  <span className="text-xs text-gray-400 ml-1"> {formatPrice(rates.exterior)}</span>
                </span>
                <span className="text-sm font-semibold text-gray-900">{formatPrice(exteriorPay)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  실내 세차 <span className="font-semibold text-gray-900">{interiorCount}건</span>
                  <span className="text-xs text-gray-400 ml-1"> {formatPrice(rates.interior)}</span>
                </span>
                <span className="text-sm font-semibold text-gray-900">{formatPrice(interiorPay)}</span>
              </div>
            </div>

            {/* 추가 보너스/지급 항목 */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600">추가 보너스/지급</p>
                <button
                  onClick={() => setShowAddBonus(!showAddBonus)}
                  className="text-blue-600 hover:text-blue-700 text-xs font-medium flex items-center gap-1"
                >
                  <Plus size={14} />
                  추가
                </button>
              </div>

              {showAddBonus && (
                <div className="bg-white rounded-lg p-3 mb-2 border border-blue-200">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">날짜</label>
                      <input
                        type="date"
                        value={newBonusDate}
                        onChange={e => setNewBonusDate(e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">항목명</label>
                      <input
                        type="text"
                        value={newBonusDesc}
                        onChange={e => setNewBonusDesc(e.target.value)}
                        placeholder="예: 추가작업"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">금액</label>
                      <input
                        type="number"
                        value={newBonusAmount}
                        onChange={e => setNewBonusAmount(e.target.value)}
                        placeholder="0"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min={0}
                        step={1000}
                      />
                    </div>
                  </div>
                  <button
                    onClick={addBonus}
                    disabled={!newBonusDate || !newBonusDesc || !newBonusAmount}
                    className="w-full bg-blue-600 text-white py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                  >
                    추가
                  </button>
                </div>
              )}

              {bonusItems.length > 0 ? (
                <div className="space-y-1">
                  {bonusItems.sort((a, b) => a.date.localeCompare(b.date)).map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm bg-white rounded px-2 py-1.5 border border-gray-200">
                      <div className="flex-1">
                        <p className="text-xs font-mono text-gray-500">{item.date}</p>
                        <p className="text-sm font-medium text-gray-800">{item.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-blue-600">{formatPrice(item.amount)}</p>
                        <button
                          onClick={() => deleteBonus(item.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">추가 항목 없음</p>
              )}

              {bonusTotal > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between">
                  <span className="text-xs text-gray-600 font-medium">보너스 소계</span>
                  <span className="text-sm font-bold text-blue-600">{formatPrice(bonusTotal)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-700">총 인건비</span>
              <span className="text-2xl font-bold text-blue-600">{formatPrice(totalPay)}</span>
            </div>
            <div className="mt-2 bg-gray-50 rounded-lg p-2 text-xs text-gray-500 text-center">
              총 작업 {records.length}건 (실외 {exteriorCount} + 실내 {interiorCount}) {bonusItems.length > 0 && `+ 보너스 ${bonusItems.length}건`}
            </div>
          </div>

          {records.length === 0 ? (
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
                                <p className="text-xs text-gray-500">세차비 {formatPrice(r.price)}</p>
                                <p className="text-sm font-semibold text-blue-600">
                                  +{formatPrice((interior ? rates.exterior + rates.interior : rates.exterior))}
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
        </>
      )}
    </div>
  )
}