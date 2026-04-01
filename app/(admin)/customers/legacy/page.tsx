'use client'

// Design Ref: §5.2 — 기존 고객 등록 (오시오 이관)
// 이전 서비스 기간(시작일~종료일) 입력, is_legacy = true 플래그

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/supabase/client'
import {
  CAR_GRADE_LABELS, MONTHLY_COUNT_LABELS, MONTHLY_PRICE_TABLE, ONETIME_PRICE_TABLE,
} from '@/lib/constants/pricing'
import { formatPrice } from '@/lib/utils'
import {
  generateSchedules, getDateLabel, getWeekdayLabel,
  type RepeatMode,
} from '@/lib/schedule/generator'
import type { CarGrade, MonthlyCount } from '@/types'

interface LegacyVehicleForm {
  car_name:       string
  plate_number:   string
  unit_number:    string
  car_grade:      CarGrade
  monthly_count:  MonthlyCount
  repeat_mode:    RepeatMode
  start_date:     string
  end_date:       string
  custom_price:   string  // 월 가격 직접 입력 가능
}

const emptyVehicle = (): LegacyVehicleForm => ({
  car_name:      '',
  plate_number:  '',
  unit_number:   '',
  car_grade:     'mid_suv',
  monthly_count: 'monthly_2',
  repeat_mode:   'date',
  start_date:    '',
  end_date:      '',
  custom_price:  '',
})

function getMonthlyPriceForGrade(grade: string, monthlyCount: string): number {
  if (monthlyCount === 'onetime') return (ONETIME_PRICE_TABLE as Record<string, number>)[grade] ?? 0
  return (MONTHLY_PRICE_TABLE[monthlyCount] as Record<string, number> | undefined)?.[grade] ?? 0
}

export default function LegacyCustomerPage() {
  const router   = useRouter()
  const supabase = db()

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const [name,      setName]      = useState('')
  const [phone,     setPhone]     = useState('')
  const [apartment, setApartment] = useState('')
  const [memo,      setMemo]      = useState('')
  const [vehicle,   setVehicle]   = useState<LegacyVehicleForm>(emptyVehicle())

  function updateVehicle(field: keyof LegacyVehicleForm, value: string) {
    setVehicle(prev => ({ ...prev, [field]: value }))
  }

  const monthlyPrice = useMemo(() => {
    const custom = parseInt(vehicle.custom_price.replace(/[^0-9]/g, ''), 10)
    if (!isNaN(custom) && custom > 0) return custom
    return getMonthlyPriceForGrade(vehicle.car_grade, vehicle.monthly_count)
  }, [vehicle.custom_price, vehicle.car_grade, vehicle.monthly_count])

  const unitPrice = useMemo(() => {
    const cnt = vehicle.monthly_count === 'monthly_1' ? 1
      : vehicle.monthly_count === 'monthly_2' ? 2
      : vehicle.monthly_count === 'monthly_4' ? 4 : 1
    return Math.round(monthlyPrice / cnt)
  }, [monthlyPrice, vehicle.monthly_count])

  const repeatPreview = useMemo(() => {
    if (vehicle.monthly_count !== 'monthly_1' || !vehicle.start_date) return null
    const d = new Date(vehicle.start_date)
    return vehicle.repeat_mode === 'weekday' ? getWeekdayLabel(d) : getDateLabel(d)
  }, [vehicle.monthly_count, vehicle.repeat_mode, vehicle.start_date])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !apartment.trim()) {
      setError('고객명과 아파트명은 필수입니다')
      return
    }
    if (!vehicle.car_name.trim() || !vehicle.plate_number.trim()) {
      setError('차량명과 차량번호는 필수입니다')
      return
    }
    if (!vehicle.start_date || !vehicle.end_date) {
      setError('서비스 시작일과 종료일을 입력해주세요')
      return
    }
    if (vehicle.start_date >= vehicle.end_date) {
      setError('종료일은 시작일보다 이후여야 합니다')
      return
    }

    setSaving(true)
    setError('')

    try {
      // 1. 고객 저장
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .insert({
          name:      name.trim(),
          phone:     phone.trim() || null,
          apartment: apartment.trim(),
          memo:      memo.trim() || null,
        })
        .select()
        .single()

      if (custErr) throw custErr

      // 2. 차량 저장 (is_legacy = true, end_date 포함)
      const { data: savedVehicle, error: vErr } = await supabase
        .from('vehicles')
        .insert({
          customer_id:   customer.id,
          car_name:      vehicle.car_name.trim(),
          plate_number:  vehicle.plate_number.trim().replace(/\s/g, ''),
          unit_number:   vehicle.unit_number.trim(),
          car_grade:     vehicle.car_grade,
          monthly_count: vehicle.monthly_count,
          repeat_mode:   vehicle.repeat_mode,
          monthly_price: monthlyPrice || null,
          unit_price:    unitPrice || null,
          start_date:    vehicle.start_date,
          end_date:      vehicle.end_date,
          status:        vehicle.monthly_count === 'onetime' ? 'irregular' : 'active',
          is_legacy:     true,
        })
        .select()
        .single()

      if (vErr) throw vErr

      // 3. 시작일 ~ 종료일 기간 내 일정 생성 (비정기 제외)
      if (vehicle.monthly_count !== 'onetime') {
        const startDate = new Date(vehicle.start_date)
        const endDate   = new Date(vehicle.end_date)
        const monthsAhead = Math.max(1,
          (endDate.getFullYear() - startDate.getFullYear()) * 12
          + (endDate.getMonth() - startDate.getMonth())
        )

        const allSchedules = generateSchedules(
          savedVehicle.id,
          startDate,
          vehicle.monthly_count as 'monthly_1' | 'monthly_2' | 'monthly_4',
          vehicle.repeat_mode,
          monthsAhead
        )

        // 종료일까지만 필터링
        const filtered = allSchedules.filter(s => s.scheduled_date <= vehicle.end_date)

        if (filtered.length > 0) {
          const { error: schErr } = await supabase
            .from('schedules')
            .insert(filtered.map(s => ({
              vehicle_id:     s.vehicle_id,
              scheduled_date: s.scheduled_date,
              is_overcount:   s.is_overcount ?? false,
              schedule_type:  'regular',
            })))

          if (schErr) throw schErr
        }
      }

      router.push('/customers')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">기존 고객 등록</h1>
          <p className="text-xs text-gray-400 mt-0.5">오시오 등 이전 서비스 데이터 이관용</p>
        </div>
      </div>

      {/* 안내 배너 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-5">
        ◆ 기존 고객은 <strong>종료일</strong>까지만 일정이 생성되며, 캘린더에 ◆ 기호로 표시됩니다.
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 고객 정보 */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-blue-600 text-sm uppercase tracking-wide mb-4">
            고객 정보
          </h2>
          <div className="space-y-3">
            <Field label="고객명" required>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="홍길동"
                className={inputCls}
                required
              />
            </Field>
            <Field label="연락처">
              <input
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="010-0000-0000" type="tel"
                className={inputCls}
              />
            </Field>
            <Field label="아파트" required>
              <input
                value={apartment} onChange={e => setApartment(e.target.value)}
                placeholder="○○아파트"
                className={inputCls}
                required
              />
            </Field>
            <Field label="메모">
              <textarea
                value={memo} onChange={e => setMemo(e.target.value)}
                placeholder="특이사항 메모" rows={2}
                className={`${inputCls} resize-none`}
              />
            </Field>
          </div>
        </section>

        {/* 차량 정보 */}
        <section className="bg-white rounded-xl border border-blue-100 p-4">
          <h2 className="font-semibold text-blue-600 text-sm uppercase tracking-wide mb-4">
            차량 정보
          </h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="차량명" required>
                <input
                  value={vehicle.car_name}
                  onChange={e => updateVehicle('car_name', e.target.value)}
                  placeholder="팰리세이드"
                  className={inputCls}
                />
              </Field>
              <Field label="차량번호" required>
                <input
                  value={vehicle.plate_number}
                  onChange={e => updateVehicle('plate_number', e.target.value)}
                  placeholder="12가3456"
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="동호수">
              <input
                value={vehicle.unit_number}
                onChange={e => updateVehicle('unit_number', e.target.value)}
                placeholder="101동 1201호"
                className={inputCls}
              />
            </Field>

            <Field label="차량등급">
              <select
                value={vehicle.car_grade}
                onChange={e => updateVehicle('car_grade', e.target.value)}
                className={selectCls}
              >
                {(Object.keys(CAR_GRADE_LABELS) as CarGrade[]).map(g => (
                  <option key={g} value={g}>{CAR_GRADE_LABELS[g]}</option>
                ))}
              </select>
            </Field>

            <Field label="월횟수">
              <select
                value={vehicle.monthly_count}
                onChange={e => updateVehicle('monthly_count', e.target.value)}
                className={selectCls}
              >
                {(Object.keys(MONTHLY_COUNT_LABELS) as MonthlyCount[]).map(mc => (
                  <option key={mc} value={mc}>{MONTHLY_COUNT_LABELS[mc]}</option>
                ))}
              </select>
            </Field>

            {/* 기존 고객 서비스 기간 */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="서비스 시작일" required>
                <input
                  type="date"
                  value={vehicle.start_date}
                  onChange={e => updateVehicle('start_date', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="서비스 종료일" required>
                <input
                  type="date"
                  value={vehicle.end_date}
                  onChange={e => updateVehicle('end_date', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* 월1회: 반복 방식 */}
            {vehicle.monthly_count === 'monthly_1' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  반복 방식
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['date', 'weekday'] as RepeatMode[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateVehicle('repeat_mode', mode)}
                      className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        vehicle.repeat_mode === mode
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {mode === 'date' ? '매월 N일' : 'N번째 요일'}
                    </button>
                  ))}
                </div>
                {repeatPreview && (
                  <p className="mt-2 text-xs text-blue-600 font-medium bg-blue-50 rounded-lg px-3 py-2">
                    반복: {repeatPreview}
                  </p>
                )}
              </div>
            )}

            {/* 월 가격 (직접 입력 가능) */}
            <Field label="월 가격 (선택 — 비우면 가격표 기준 자동 입력)">
              <input
                value={vehicle.custom_price}
                onChange={e => updateVehicle('custom_price', e.target.value)}
                placeholder={`가격표 기준: ${formatPrice(getMonthlyPriceForGrade(vehicle.car_grade, vehicle.monthly_count))}`}
                type="number"
                className={inputCls}
              />
            </Field>

            {/* 가격 미리보기 */}
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <div className="text-gray-600">
                월 정가: <span className="font-semibold text-gray-900">{formatPrice(monthlyPrice)}</span>
              </div>
              <div className="text-gray-600 mt-0.5">
                1회 단가: <span className="font-semibold text-blue-700">{formatPrice(unitPrice)}</span>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit" disabled={saving}
          className="w-full bg-amber-500 text-white py-3 rounded-xl font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors text-sm"
        >
          {saving ? '저장 중...' : '◆ 기존 고객으로 등록'}
        </button>
      </form>
    </div>
  )
}

/* ───────────── 공통 UI 헬퍼 ───────────── */
const inputCls  = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const selectCls = `${inputCls} bg-white`

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
