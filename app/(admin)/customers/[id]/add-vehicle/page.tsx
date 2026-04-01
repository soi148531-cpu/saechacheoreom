'use client'

// Design Ref: §5.2 — 기존 고객에 차량 추가 등록

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient, db } from '@/lib/supabase/client'
import {
  CAR_GRADE_LABELS, MONTHLY_COUNT_LABELS,
  getMonthlyPrice,
} from '@/lib/constants/pricing'
import { formatPrice } from '@/lib/utils'
import {
  generateSchedules, getDateLabel, getWeekdayLabel,
  type RepeatMode,
} from '@/lib/schedule/generator'
import type { CarGrade, MonthlyCount, Customer } from '@/types'

interface VehicleForm {
  car_name:      string
  plate_number:  string
  unit_number:   string
  car_grade:     CarGrade
  monthly_count: MonthlyCount
  repeat_mode:   RepeatMode
  start_date:    string
}

const emptyVehicle = (): VehicleForm => ({
  car_name:      '',
  plate_number:  '',
  unit_number:   '',
  car_grade:     'mid_suv',
  monthly_count: 'monthly_2',
  repeat_mode:   'date',
  start_date:    new Date().toISOString().split('T')[0],
})

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

export default function AddVehiclePage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const supabase = createClient()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [vehicle,  setVehicle]  = useState<VehicleForm>(emptyVehicle())
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const fetchCustomer = useCallback(async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()
    if (data) setCustomer(data as Customer)
  }, [id, supabase])

  useEffect(() => { fetchCustomer() }, [fetchCustomer])

  function updateVehicle(field: keyof VehicleForm, value: string) {
    setVehicle(prev => ({ ...prev, [field]: value }))
  }

  const monthlyPrice = vehicle.monthly_count !== 'onetime'
    ? getMonthlyPrice(vehicle.car_grade, vehicle.monthly_count)
    : null
  const unitPrice = monthlyPrice
    ? monthlyPrice / (vehicle.monthly_count === 'monthly_1' ? 1 : vehicle.monthly_count === 'monthly_2' ? 2 : 4)
    : 0

  const repeatPreview = useMemo(() => {
    if (vehicle.monthly_count !== 'monthly_1') return null
    const d = new Date(vehicle.start_date)
    return vehicle.repeat_mode === 'weekday' ? getWeekdayLabel(d) : getDateLabel(d)
  }, [vehicle.monthly_count, vehicle.repeat_mode, vehicle.start_date])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vehicle.car_name.trim() || !vehicle.plate_number.trim()) {
      setError('차량명과 차량번호는 필수입니다')
      return
    }
    setSaving(true)
    setError('')

    try {
      const status = vehicle.monthly_count === 'onetime' ? 'irregular' : 'active'

      const { data: savedVehicle, error: vErr } = await db()
        .from('vehicles')
        .insert({
          customer_id:   id,
          car_name:      vehicle.car_name.trim(),
          plate_number:  vehicle.plate_number.trim().replace(/\s/g, ''),
          unit_number:   vehicle.unit_number.trim(),
          car_grade:     vehicle.car_grade,
          monthly_count: vehicle.monthly_count,
          repeat_mode:   vehicle.repeat_mode,
          monthly_price: monthlyPrice ?? null,
          unit_price:    unitPrice || null,
          start_date:    vehicle.start_date,
          status,
        })
        .select()
        .single()

      if (vErr) throw vErr

      // 일정 자동 생성 (비정기 제외)
      if (vehicle.monthly_count !== 'onetime') {
        const startDate = new Date(vehicle.start_date)
        const schedules = generateSchedules(
          savedVehicle.id,
          startDate,
          vehicle.monthly_count as 'monthly_1' | 'monthly_2' | 'monthly_4',
          vehicle.repeat_mode,
          12
        )

        const { error: schErr } = await db()
          .from('schedules')
          .insert(schedules.map(s => ({
            vehicle_id:     s.vehicle_id,
            scheduled_date: s.scheduled_date,
            is_overcount:   s.is_overcount ?? false,
            schedule_type:  'regular',
          })))

        if (schErr) throw schErr
      }

      router.push(`/customers/${id}`)
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
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">차량 추가</h1>
          {customer && (
            <p className="text-xs text-gray-400 mt-0.5">{customer.name} · {customer.apartment}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
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

            <Field label="서비스 시작일" required>
              <input
                type="date"
                value={vehicle.start_date}
                onChange={e => updateVehicle('start_date', e.target.value)}
                className={inputCls}
              />
            </Field>

            {/* 월1회: 반복 방식 선택 */}
            {vehicle.monthly_count === 'monthly_1' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">반복 방식</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateVehicle('repeat_mode', 'date')}
                    className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      vehicle.repeat_mode === 'date'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    매월 N일
                  </button>
                  <button
                    type="button"
                    onClick={() => updateVehicle('repeat_mode', 'weekday')}
                    className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      vehicle.repeat_mode === 'weekday'
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
          </div>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit" disabled={saving}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
        >
          {saving ? '저장 중...' : '차량 추가하기'}
        </button>
      </form>
    </div>
  )
}
