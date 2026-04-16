'use client'

// Design Ref: §5.2 — 고객+차량 신규 등록
// Design Ref: §3.3 — 월1회 반복방식: 네이버 캘린더 방식 (date / weekday)
// Plan SC: SC-01, SC-02

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { db } from '@/lib/supabase/client'
import {
  CAR_GRADE_LABELS, MONTHLY_COUNT_LABELS,
} from '@/lib/constants/pricing'
import { usePricing } from '@/lib/hooks/usePricing'
import { formatPrice } from '@/lib/utils'
import {
  generateSchedules, getDateLabel, getWeekdayLabel, parseLocalDate,
  type RepeatMode,
} from '@/lib/schedule/generator'
import type { CarGrade, MonthlyCount } from '@/types'

interface VehicleForm {
  car_name:       string
  plate_number:   string
  car_grade:      CarGrade
  monthly_count:  MonthlyCount
  repeat_mode:    RepeatMode   // 월1회 전용
  start_date:     string
  end_date:       string
  base_date:      string
  interior_count: number
  is_new_customer: boolean
}

const emptyVehicle = (): VehicleForm => ({
  car_name:       '',
  plate_number:   '',
  car_grade:      'mid_suv',
  monthly_count:  'monthly_2',
  repeat_mode:    'date',
  start_date:     '',
  end_date:       '',
  base_date:      new Date().toISOString().split('T')[0],
  interior_count: 0,
  is_new_customer: true,
})

export default function NewCustomerPage() {
  const router   = useRouter()
  const supabase = db()
  const { getMonthlyPrice } = usePricing()

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // 고객 정보
  const [name,      setName]      = useState('')
  const [phone,     setPhone]     = useState('')
  const [apartment, setApartment] = useState('')
  const [unitNumber, setUnitNumber] = useState('')
  const [memo,      setMemo]      = useState('')

  // 차량 목록
  const [vehicles, setVehicles] = useState<VehicleForm[]>([emptyVehicle()])

  function updateVehicle(idx: number, field: keyof VehicleForm, value: string | boolean) {
    setVehicles(prev =>
      prev.map((v, i) => i === idx ? {
        ...v,
        [field]: typeof value === 'boolean' ? value : field === 'interior_count' ? Number(value) : value
      } : v)
    )
  }

  function addVehicle() {
    setVehicles(prev => [...prev, emptyVehicle()])
  }

  function removeVehicle(idx: number) {
    setVehicles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !apartment.trim()) {
      setError('고객명과 아파트명은 필수입니다')
      return
    }
    setSaving(true)
    setError('')

    try {
      // 1. 고객 저장
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .insert({
          name:        name.trim(),
          phone:       phone.trim() || null,
          apartment:   apartment.trim(),
          unit_number: unitNumber.trim() || null,
          memo:        memo.trim() || null,
        })
        .select()
        .single()

      if (custErr) throw custErr

      // 2. 차량 + 일정 저장
      for (const v of vehicles) {
        if (!v.car_name.trim() || !v.plate_number.trim()) continue

        const monthly_price = v.monthly_count === 'onetime'
          ? null
          : getMonthlyPrice(v.car_grade, v.monthly_count)
        const unit_price = v.monthly_count === 'onetime'
          ? 0
          : getMonthlyPrice(v.car_grade, v.monthly_count) / (v.monthly_count === 'monthly_1' ? 1 : v.monthly_count === 'monthly_2' ? 2 : 4)
        const status     = v.monthly_count === 'onetime' ? 'irregular' : 'active'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: vehicle, error: vErr } = await (supabase as any)
          .from('vehicles')
          .insert({
            customer_id:   customer.id,
            car_name:      v.car_name.trim(),
            plate_number:  v.plate_number.trim().replace(/\s/g, ''),
            car_grade:     v.car_grade,
            monthly_count: v.monthly_count,
            repeat_mode:   v.repeat_mode,
            monthly_price,
            unit_price,
            start_date:      v.start_date || v.base_date,
            end_date:        v.end_date || null,
            interior_count:  v.interior_count,
            is_new_customer: v.is_new_customer,
            status,
          })
          .select()
          .single()

        if (vErr) throw vErr

        // 3. 일정 자동 생성 (비정기 제외)
        if (v.monthly_count !== 'onetime') {
          const baseDate = parseLocalDate(v.base_date)
          const schedules = generateSchedules(
            vehicle.id,
            baseDate,
            v.monthly_count as 'monthly_1' | 'monthly_2' | 'monthly_4',
            v.repeat_mode,
            24
          )

          const { error: schErr } = await supabase
            .from('schedules')
            .insert(schedules.map(s => ({
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
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">신규 등록</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
            <Field label="동호수">
              <input
                value={unitNumber} onChange={e => setUnitNumber(e.target.value)}
                placeholder="101동 1201호"
                className={inputCls}
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

        {/* 차량 목록 */}
        {vehicles.map((v, idx) => (
          <VehicleCard
            key={idx}
            v={v}
            idx={idx}
            onUpdate={updateVehicle}
            onRemove={removeVehicle}
            showRemove={vehicles.length > 1}
          />
        ))}

        {/* 차량 추가 버튼 */}
        <button
          type="button" onClick={addVehicle}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Plus size={16} />
          차량 추가 (한 고객 차량 여러 대 등록)
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit" disabled={saving}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </form>
    </div>
  )
}

/* ───────────── 차량 카드 컴포넌트 ───────────── */
function VehicleCard({
  v, idx, onUpdate, onRemove, showRemove,
}: {
  v: VehicleForm
  idx: number
  onUpdate: (i: number, f: keyof VehicleForm, val: string | boolean) => void
  onRemove: (i: number) => void
  showRemove: boolean
}) {
  const { getMonthlyPrice } = usePricing()
  const unitPrice    = v.monthly_count === 'onetime'
    ? 0
    : getMonthlyPrice(v.car_grade, v.monthly_count) / (v.monthly_count === 'monthly_1' ? 1 : v.monthly_count === 'monthly_2' ? 2 : 4)
  const monthlyPrice = v.monthly_count !== 'onetime'
    ? getMonthlyPrice(v.car_grade, v.monthly_count) : null

  // 반복 방식 레이블 미리보기 (신규 기준일 기준)
  const repeatPreview = useMemo(() => {
    if (v.monthly_count !== 'monthly_1') return null
    if (!v.base_date) return null
    const d = parseLocalDate(v.base_date)
    return v.repeat_mode === 'weekday' ? getWeekdayLabel(d) : getDateLabel(d)
  }, [v.monthly_count, v.repeat_mode, v.base_date])

  return (
    <section className="bg-white rounded-xl border border-blue-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-blue-600 text-sm uppercase tracking-wide">
          차량 {idx + 1}
        </h2>
        {showRemove && (
          <button type="button" onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-600">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* 신규차량 탭 */}
      <button
        type="button"
        onClick={() => onUpdate(idx, 'is_new_customer', !v.is_new_customer)}
        className={`w-full mb-3 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
          v.is_new_customer
            ? 'bg-rose-50 border-rose-400 text-rose-600'
            : 'bg-gray-50 border-gray-200 text-gray-400'
        }`}
      >
        {v.is_new_customer ? '★ 신규차량 (첫 작업 무료)' : '신규차량 아님'}
      </button>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="차량명">
            <input
              value={v.car_name}
              onChange={e => onUpdate(idx, 'car_name', e.target.value)}
              placeholder="팰리세이드"
              className={inputCls}
            />
          </Field>
          <Field label="차량번호">
            <input
              value={v.plate_number}
              onChange={e => onUpdate(idx, 'plate_number', e.target.value)}
              placeholder="12가3456"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="차량등급">
          <select
            value={v.car_grade}
            onChange={e => onUpdate(idx, 'car_grade', e.target.value)}
            className={selectCls}
          >
            {(Object.keys(CAR_GRADE_LABELS) as CarGrade[]).map(g => (
              <option key={g} value={g}>{CAR_GRADE_LABELS[g]}</option>
            ))}
          </select>
        </Field>

        <Field label="월횟수">
          <select
            value={v.monthly_count}
            onChange={e => onUpdate(idx, 'monthly_count', e.target.value)}
            className={selectCls}
          >
            {(Object.keys(MONTHLY_COUNT_LABELS) as MonthlyCount[]).map(mc => (
              <option key={mc} value={mc}>{MONTHLY_COUNT_LABELS[mc]}</option>
            ))}
          </select>
        </Field>

        {/* 서비스 시작일 / 종료일 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="서비스 시작일">
            <input
              type="date"
              value={v.start_date}
              onChange={e => onUpdate(idx, 'start_date', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="서비스 종료일">
            <input
              type="date"
              value={v.end_date}
              onChange={e => onUpdate(idx, 'end_date', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        {/* 신규 기준일 — 반복 일정 생성 기준 (비정기 제외) */}
        {v.monthly_count !== 'onetime' && (
          <>
            <Field label="신규 기준일">
              <input
                type="date"
                value={v.base_date}
                onChange={e => onUpdate(idx, 'base_date', e.target.value)}
                className={inputCls}
              />
            </Field>
            <p className="text-xs text-gray-400 -mt-2">
              이 날짜를 기준으로 반복 일정이 1년치 자동 생성됩니다
            </p>
          </>
        )}

        {/* 월1회: 반복 방식 선택 (네이버 캘린더 방식) */}
        {v.monthly_count === 'monthly_1' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              반복 방식
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdate(idx, 'repeat_mode', 'date')}
                className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  v.repeat_mode === 'date'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                매월 N일
              </button>
              <button
                type="button"
                onClick={() => onUpdate(idx, 'repeat_mode', 'weekday')}
                className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  v.repeat_mode === 'weekday'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                N번째 요일
              </button>
            </div>
            {repeatPreview && (
              <p className="mt-2 text-xs text-blue-600 font-medium bg-blue-50 rounded-lg px-3 py-2">
                반복: {repeatPreview}
              </p>
            )}
          </div>
        )}

        {/* 가격 미리보기 */}
        <div className="bg-blue-50 rounded-lg p-3 text-sm">
          {monthlyPrice && (
            <div className="text-gray-600">
              월 정가: <span className="font-semibold text-gray-900">{formatPrice(monthlyPrice)}</span>
            </div>
          )}
          <div className="text-gray-600 mt-0.5">
            1회 단가: <span className="font-semibold text-blue-700">{formatPrice(unitPrice)}</span>
          </div>
        </div>

        {/* 실내 세차 횟수 (월1) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            실내 세차 (월1)
          </label>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => onUpdate(idx, 'interior_count', String(n))}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  v.interior_count === n
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
                }`}
              >
                {n === 0 ? '없음' : `${n}회`}
              </button>
            ))}
          </div>
          {v.interior_count > 0 && (
            <p className="mt-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
              쾘린더에 &lt;실내{v.interior_count}회&gt; 표시 — 관리자가 월초에 수동 체크
            </p>
          )}
        </div>
      </div>
    </section>
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
