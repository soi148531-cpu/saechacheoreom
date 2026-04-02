'use client'

// Design Ref: §5.2 — 고객 상세 + 차량 목록 + 상태 변경

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Phone, Car, Calendar,
  PauseCircle, PlayCircle, Trash2, Pencil, Check, X
} from 'lucide-react'
import { createClient, db } from '@/lib/supabase/client'
import { CAR_GRADE_LABELS, MONTHLY_COUNT_LABELS } from '@/lib/constants/pricing'
import { formatPrice, formatDate } from '@/lib/utils'
import type { Customer, Vehicle, VehicleStatus } from '@/types'

const STATUS_LABELS: Record<VehicleStatus, string> = {
  active:       '정기',
  paused:       '정지',
  irregular:    '비정기',
  unregistered: '미등록',
}

const STATUS_COLORS: Record<VehicleStatus, string> = {
  active:       'bg-green-100 text-green-700',
  paused:       'bg-yellow-100 text-yellow-700',
  irregular:    'bg-blue-100 text-blue-700',
  unregistered: 'bg-gray-100 text-gray-500',
}

export default function CustomerDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const supabase = createClient()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading,  setLoading]  = useState(true)
  // 편집 모드
  const [editing,     setEditing]     = useState(false)
  const [editName,    setEditName]    = useState('')
  const [editPhone,   setEditPhone]   = useState('')
  const [editApart,   setEditApart]   = useState('')
  const [editMemo,    setEditMemo]    = useState('')
  const [editSaving,  setEditSaving]  = useState(false)
  // 서비스 정지: 어떤 차량이 정지 대기 중인지, 날짜 선택 값
  const [pausingId,   setPausingId]   = useState<string | null>(null)
  const [pauseDate,   setPauseDate]   = useState('')
  const [pauseSaving, setPauseSaving] = useState(false)

  const fetchCustomer = useCallback(async () => {
    const { data } = await supabase
      .from('customers')
      .select('*, vehicles(*)')
      .eq('id', id)
      .single()
    if (data) {
      setCustomer(data as Customer)
      setEditName((data as Customer).name)
      setEditPhone((data as Customer).phone ?? '')
      setEditApart((data as Customer).apartment)
      setEditMemo((data as Customer).memo ?? '')
    }
    setLoading(false)
  }, [id, supabase])

  useEffect(() => { fetchCustomer() }, [fetchCustomer])

  async function saveEdit() {
    if (!editName.trim() || !editApart.trim()) return
    setEditSaving(true)
    await db().from('customers').update({
      name:      editName.trim(),
      phone:     editPhone.trim() || null,
      apartment: editApart.trim(),
      memo:      editMemo.trim() || null,
    }).eq('id', id)
    setEditSaving(false)
    setEditing(false)
    fetchCustomer()
  }

  async function toggleVehicleStatus(vehicle: Vehicle) {
    if (vehicle.status === 'paused') {
      // 재개: 바로 상태만 변경
      await db().from('vehicles').update({ status: 'active' }).eq('id', vehicle.id)
      fetchCustomer()
    } else {
      // 정지: 날짜 선택 UI 표시 (today 기본값)
      const today = new Date().toISOString().split('T')[0]
      setPauseDate(today)
      setPausingId(vehicle.id)
    }
  }

  async function confirmPause() {
    if (!pausingId || !pauseDate) return
    setPauseSaving(true)
    try {
      // 1. 선택날짜 이후(이상) 일정 전체 삭제
      await db()
        .from('schedules')
        .delete()
        .eq('vehicle_id', pausingId)
        .gte('scheduled_date', pauseDate)
      // 2. 상태 변경
      await db().from('vehicles').update({ status: 'paused' }).eq('id', pausingId)
      setPausingId(null)
      fetchCustomer()
    } finally {
      setPauseSaving(false)
    }
  }

  async function deleteVehicle(vehicleId: string) {
    if (!confirm('이 차량을 삭제하시겠습니까? 관련 일정과 실적도 모두 삭제됩니다.')) return
    await db().from('vehicles').delete().eq('id', vehicleId)
    fetchCustomer()
  }

  async function deleteCustomer() {
    if (!confirm('고객을 삭제하시겠습니까? 모든 차량 데이터도 함께 삭제됩니다.')) return
    await db().from('customers').delete().eq('id', id)
    router.push('/customers')
  }

  if (loading) return <div className="p-8 text-center text-gray-400">불러오는 중...</div>
  if (!customer) return <div className="p-8 text-center text-gray-400">고객을 찾을 수 없습니다</div>

  return (
    <div className="p-4 max-w-xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{customer.name}</h1>
        <button onClick={() => setEditing(true)} className="text-blue-400 hover:text-blue-600 p-1">
          <Pencil size={17} />
        </button>
        <button onClick={deleteCustomer} className="text-red-400 hover:text-red-600 p-1">
          <Trash2 size={18} />
        </button>
      </div>

      {/* 고객 정보 */}
      <section className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">고객 정보</h2>
        {editing ? (
          <div className="space-y-2">
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="고객명"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={editPhone}
              onChange={e => setEditPhone(e.target.value)}
              placeholder="연락처 (선택)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={editApart}
              onChange={e => setEditApart(e.target.value)}
              placeholder="아파트"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              value={editMemo}
              onChange={e => setEditMemo(e.target.value)}
              placeholder="메모 (선택)"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Check size={14} />{editSaving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                <X size={14} />취소
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <Car size={15} className="text-gray-400" />
              <span>{customer.apartment}</span>
            </div>
            {customer.phone && (
              <div className="flex items-center gap-2 text-gray-700">
                <Phone size={15} className="text-gray-400" />
                <a href={`tel:${customer.phone}`} className="text-blue-600">{customer.phone}</a>
              </div>
            )}
            {customer.memo && (
              <p className="text-gray-500 bg-gray-50 rounded-lg px-3 py-2 text-xs mt-2">
                {customer.memo}
              </p>
            )}
          </div>
        )}
      </section>

      {/* 차량 목록 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-800">등록 차량 ({customer.vehicles?.length ?? 0}대)</h2>
        <Link
          href={`/customers/${id}/add-vehicle`}
          className="flex items-center gap-1 text-blue-600 text-sm font-medium hover:text-blue-700"
        >
          <Plus size={15} />
          차량 추가
        </Link>
      </div>

      <div className="space-y-3">
        {(!customer.vehicles || customer.vehicles.length === 0) ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-400 text-sm">
            등록된 차량이 없습니다
          </div>
        ) : (
          customer.vehicles.map(v => (
            <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{v.car_name}</span>
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {v.plate_number}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[v.status]}`}>
                      {STATUS_LABELS[v.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{v.unit_number}</p>
                </div>
                <button
                  onClick={() => deleteVehicle(v.id)}
                  className="text-red-300 hover:text-red-500 ml-2"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                <div>
                  <span className="text-gray-400">등급</span>{' '}
                  <span className="font-medium">{CAR_GRADE_LABELS[v.car_grade]}</span>
                </div>
                <div>
                  <span className="text-gray-400">월횟수</span>{' '}
                  <span className="font-medium">{MONTHLY_COUNT_LABELS[v.monthly_count]}</span>
                </div>
                {v.monthly_price && (
                  <div>
                    <span className="text-gray-400">월정가</span>{' '}
                    <span className="font-medium">{formatPrice(v.monthly_price)}</span>
                  </div>
                )}
                {v.unit_price && (
                  <div>
                    <span className="text-gray-400">1회단가</span>{' '}
                    <span className="font-medium text-blue-600">{formatPrice(v.unit_price)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                <Calendar size={12} />
                <span>시작: {formatDate(v.start_date)}</span>
                {v.end_date && <span>~ 종료: {formatDate(v.end_date)}</span>}
              </div>

              {/* 정지/재개 버튼 */}
              {(v.status === 'active' || v.status === 'paused') && (
                pausingId === v.id ? (
                  // 날짜 선택 UI
                  <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-yellow-800">⏸️ 정지 기준일 — 이 날짜이후(이상)의 일정이 삭제됩니다</p>
                    <input
                      type="date"
                      value={pauseDate}
                      onChange={e => setPauseDate(e.target.value)}
                      className="w-full border border-yellow-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={confirmPause}
                        disabled={!pauseDate || pauseSaving}
                        className="flex-1 bg-yellow-500 text-white py-2 rounded-lg text-xs font-semibold hover:bg-yellow-600 disabled:opacity-50"
                      >
                        {pauseSaving ? '삭제 중...' : '정지 확인'}
                      </button>
                      <button
                        onClick={() => setPausingId(null)}
                        className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-xs font-semibold hover:bg-gray-200"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleVehicleStatus(v)}
                    className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      v.status === 'active'
                        ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                        : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                    }`}
                  >
                    {v.status === 'active'
                      ? <><PauseCircle size={14} /> 서비스 정지</>
                      : <><PlayCircle size={14} /> 서비스 재개</>
                    }
                  </button>
                )
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
