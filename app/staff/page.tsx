'use client'

// Design Ref: §5.6 — 직원 작업 체크 페이지 (로그인 없이 URL 공유)
// Plan SC: SC-04

import { useEffect, useState, useRef, useCallback } from 'react'
import { Camera, CheckCircle2, Circle, Upload, ChevronDown, ChevronUp, Home, Check, X, Sofa, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { createClient, db } from '@/lib/supabase/client'
import { CAR_GRADE_LABELS, INTERIOR_PRICE } from '@/lib/constants/pricing'
import type { Vehicle, Schedule } from '@/types'

type ScheduleRow = Schedule & {
  admin_memo?: string | null
  vehicle: Vehicle & { customer: { name: string; apartment: string } }
}

type SchemaSupport = {
  scheduleAdminMemo: boolean
  washAdminNote: boolean
  washCompletedBy: boolean
}

interface TaskItem {
  schedule: ScheduleRow
  done: boolean
  memo: string          // 작업자 메모
  adminNote: string     // 관리자 작업지시
  completedBy: 'worker' | 'admin' | null
  interiorDone: boolean // 실내 완료 여부 (직원이 결정)
  photos: string[]
  uploading: boolean
  expanded: boolean
  washRecordId: string | null
  editingAdminNote: boolean
}

export default function StaffPage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [tasks,   setTasks]   = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [date,    setDate]    = useState(today)
  const [schemaSupport, setSchemaSupport] = useState<SchemaSupport | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const detectSchemaSupport = useCallback(async () => {
    const [{ error: scheduleAdminMemoError }, { error: washAdminNoteError }, { error: washCompletedByError }] = await Promise.all([
      supabase.from('schedules').select('id, admin_memo').limit(1),
      supabase.from('wash_records').select('id, admin_note').limit(1),
      supabase.from('wash_records').select('id, completed_by').limit(1),
    ])

    const support = {
      scheduleAdminMemo: !scheduleAdminMemoError,
      washAdminNote: !washAdminNoteError,
      washCompletedBy: !washCompletedByError,
    }

    setSchemaSupport(prev => {
      if (
        prev?.scheduleAdminMemo === support.scheduleAdminMemo &&
        prev?.washAdminNote === support.washAdminNote &&
        prev?.washCompletedBy === support.washCompletedBy
      ) {
        return prev
      }
      return support
    })

    return support
  }, [supabase])

  const fetchTasks = useCallback(async () => {
    setLoading(true)

    const support = schemaSupport ?? await detectSchemaSupport()

    const scheduleSelect = support.scheduleAdminMemo
      ? '*, vehicle:vehicles(*, customer:customers(name, apartment)), admin_memo'
      : '*, vehicle:vehicles(*, customer:customers(name, apartment))'

    const washRecordColumns = ['id', 'vehicle_id', 'memo']
    if (support.washAdminNote) washRecordColumns.push('admin_note')
    if (support.washCompletedBy) washRecordColumns.push('completed_by')

    const { data: schedules, error } = await supabase
      .from('schedules')
      .select(scheduleSelect)
      .eq('scheduled_date', date)
      .eq('is_deleted', false)
      .order('created_at')

    if (error || !schedules) { setLoading(false); return }

    const rows = schedules as ScheduleRow[]

    const vehicleIds = rows.map(s => s.vehicle_id)
    const { data: records } = vehicleIds.length > 0
      ? await supabase
          .from('wash_records')
          .select(washRecordColumns.join(','))
          .in('vehicle_id', vehicleIds)
          .eq('wash_date', date)
      : { data: [] as Array<{ id: string; vehicle_id: string; memo: string | null; admin_note: string | null; completed_by: string | null }> }

    const { data: photos } = vehicleIds.length > 0
      ? await supabase
          .from('wash_photos')
          .select('vehicle_id, photo_url')
          .in('vehicle_id', vehicleIds)
          .gte('created_at', `${date}T00:00:00`)
          .lte('created_at', `${date}T23:59:59`)
      : { data: [] as Array<{ vehicle_id: string; photo_url: string }> }

    const photoRows  = (photos  ?? []) as Array<{ vehicle_id: string; photo_url: string }>
    const recordRows = (records ?? []) as Array<{ id: string; vehicle_id: string; memo: string | null; admin_note: string | null; completed_by: string | null }>

    const items: TaskItem[] = rows.map(s => {
      const record = recordRows.find(r => r.vehicle_id === s.vehicle_id)
      const vehiclePhotos = photoRows.filter(p => p.vehicle_id === s.vehicle_id).map(p => p.photo_url)
      // 기존 완료 기록에서 실내 여부 복원: price > unit_price 면 실내 완료했던 것
      const basePrice = (s.vehicle as ScheduleRow['vehicle']).unit_price ?? 0
      const prevInteriorDone = record
        ? (record as unknown as { price?: number }).price !== undefined
          ? ((record as unknown as { price: number }).price - basePrice) > 0
          : false
        : s.has_interior  // 미완료면 실내有인 경우 기본 체크
      return {
        schedule:         s as ScheduleRow,
        done:             !!record,
        memo:             record?.memo ?? '',
        adminNote:        s.admin_memo ?? record?.admin_note ?? '',
        completedBy:      (record?.completed_by as 'worker' | 'admin' | null) ?? null,
        interiorDone:     prevInteriorDone,
        photos:           vehiclePhotos,
        uploading:        false,
        expanded:         !record,
        washRecordId:     record?.id ?? null,
        editingAdminNote: false,
      }
    })

    // sort_order 기준 정렬
    items.sort((a, b) => {
      const sa = a.schedule.sort_order
      const sb = b.schedule.sort_order
      if (sa != null && sb != null) return sa - sb
      if (sa != null) return -1
      if (sb != null) return 1
      return new Date(a.schedule.created_at).getTime() - new Date(b.schedule.created_at).getTime()
    })

    setTasks(items)
    setLoading(false)
  }, [date, detectSchemaSupport, schemaSupport, supabase])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  function updateTask(idx: number, patch: Partial<TaskItem>) {
    setTasks(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t))
  }

  async function toggleDone(idx: number, completedBy: 'worker' | 'admin' = 'worker') {
    const task = tasks[idx]
    const v = task.schedule.vehicle
    const support = schemaSupport ?? await detectSchemaSupport()
    setSavingKey(`done:${task.schedule.id}`)

    if (task.done) {
      if (task.washRecordId) {
        const { error } = await db().from('wash_records').delete().eq('id', task.washRecordId)
        if (error) {
          alert('완료 취소 실패: ' + error.message)
          setSavingKey(null)
          return
        }
      }
      updateTask(idx, { done: false, washRecordId: null, completedBy: null })
      setSavingKey(null)
    } else {
      if (support.scheduleAdminMemo) {
        const { error: scheduleError } = await db()
          .from('schedules')
          .update({ admin_memo: task.adminNote.trim() || null })
          .eq('id', task.schedule.id)

        if (scheduleError) {
          alert('작업지시 저장 실패: ' + scheduleError.message)
          setSavingKey(null)
          return
        }
      }

      const hasInterior = task.schedule.has_interior && task.interiorDone
      const interiorPrice = hasInterior ? INTERIOR_PRICE : 0

      const payload: Record<string, unknown> = {
        vehicle_id: v.id,
        schedule_id: task.schedule.id,
        wash_date: date,
        price: (v.unit_price ?? 0) + interiorPrice,
        is_completed: true,
        memo: task.memo.trim() || null,
      }

      if (support.washAdminNote) payload.admin_note = task.adminNote.trim() || null
      if (support.washCompletedBy) payload.completed_by = completedBy

      const { data: rec, error } = await db()
        .from('wash_records')
        .insert(payload)
        .select()
        .single()

      if (error) {
        alert('완료 처리 실패: ' + error.message)
        setSavingKey(null)
        return
      }

      if (rec) {
        updateTask(idx, { done: true, washRecordId: rec.id, completedBy, expanded: false })
      }
      setSavingKey(null)
    }
  }

  async function saveAdminNote(idx: number) {
    const task = tasks[idx]
    const support = schemaSupport ?? await detectSchemaSupport()
    setSavingKey(`admin:${task.schedule.id}`)

    if (!support.scheduleAdminMemo && !support.washAdminNote) {
      alert('운영 DB에 관리자 작업지시 저장 컬럼이 없어 저장할 수 없습니다. DB 마이그레이션이 필요합니다.')
      setSavingKey(null)
      return
    }

    if (support.scheduleAdminMemo) {
      const { error } = await db()
        .from('schedules')
        .update({ admin_memo: task.adminNote.trim() || null })
        .eq('id', task.schedule.id)

      if (error) {
        alert('저장 실패: ' + error.message)
        setSavingKey(null)
        return
      }
    }

    if (task.washRecordId && support.washAdminNote) {
      const { error } = await db()
        .from('wash_records')
        .update({ admin_note: task.adminNote.trim() || null })
        .eq('id', task.washRecordId)

      if (error) {
        alert('저장 실패: ' + error.message)
        setSavingKey(null)
        return
      }
    }

    updateTask(idx, { editingAdminNote: false })
    setSavingKey(null)
  }

  async function saveWorkerMemo(idx: number) {
    const task = tasks[idx]

    if (!task.washRecordId) {
      alert('작업자 메모는 완료 처리 시 함께 저장됩니다.')
      return
    }

    setSavingKey(`memo:${task.schedule.id}`)
    const { error } = await db()
      .from('wash_records')
      .update({ memo: task.memo.trim() || null })
      .eq('id', task.washRecordId)

    if (error) {
      alert('메모 저장 실패: ' + error.message)
      setSavingKey(null)
      return
    }

    setSavingKey(null)
  }

  async function uploadPhoto(idx: number, file: File) {
    const task = tasks[idx]
    const v = task.schedule.vehicle
    updateTask(idx, { uploading: true })

    const ext  = file.name.split('.').pop()
    const path = `wash-photos/${date}/${v.id}_${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('photos')
      .upload(path, file, { upsert: false })

    if (upErr) {
      alert('사진 업로드 실패: ' + upErr.message)
      updateTask(idx, { uploading: false })
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(path)

    await db().from('wash_photos').insert({
      vehicle_id: v.id,
      photo_url:  publicUrl,
      wash_date:  date,
    })

    updateTask(idx, {
      photos: [...task.photos, publicUrl],
      uploading: false,
    })
  }

  const completedCount = tasks.filter(t => t.done).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">직원 페이지</h1>
            <p className="text-xs text-gray-400">새차처럼 세차 서비스</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
            >
              <CalendarDays size={14} />
              캘린더
            </Link>
            <div className="text-right">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700"
            />
            <p className="text-xs text-gray-500 mt-0.5">
              {completedCount} / {tasks.length} 완료
            </p>
            </div>
          </div>
        </div>
        {tasks.length > 0 && (
          <div className="h-1 bg-gray-100">
            <div
              className="h-1 bg-blue-500 transition-all"
              style={{ width: `${(completedCount / tasks.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="text-center py-16 text-gray-400">불러오는 중...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">오늘 예약된 차량이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schemaSupport && !schemaSupport.scheduleAdminMemo && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                관리자 작업지시 저장용 DB 컬럼이 아직 반영되지 않아, 현재는 완료 처리와 완료 후 작업자 메모 저장만 정상 동작합니다.
              </div>
            )}
            {tasks.map((task, idx) => (
              <TaskCard
                key={task.schedule.id}
                task={task}
                isSaving={savingKey === `done:${task.schedule.id}` || savingKey === `admin:${task.schedule.id}` || savingKey === `memo:${task.schedule.id}`}
                canPersistAdminNote={!!schemaSupport?.scheduleAdminMemo || !!schemaSupport?.washAdminNote}
                onToggleWorker={() => toggleDone(idx, 'worker')}
                onToggleAdmin={() => toggleDone(idx, 'admin')}
                onCancel={() => toggleDone(idx)}
                onInteriorToggle={() => updateTask(idx, { interiorDone: !task.interiorDone })}
                onMemoChange={v => updateTask(idx, { memo: v })}
                onMemoSave={() => saveWorkerMemo(idx)}
                onAdminNoteChange={v => updateTask(idx, { adminNote: v })}
                onAdminNoteEditStart={() => updateTask(idx, { editingAdminNote: true })}
                onAdminNoteSave={() => saveAdminNote(idx)}
                onAdminNoteCancel={() => updateTask(idx, { editingAdminNote: false })}
                onExpand={() => updateTask(idx, { expanded: !task.expanded })}
                onPhotoUpload={file => uploadPhoto(idx, file)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 작업 카드 ─── */
function TaskCard({
  task, onToggleWorker, onToggleAdmin, onCancel,
  onInteriorToggle,
  onMemoChange, onMemoSave, onAdminNoteChange,
  onAdminNoteEditStart, onAdminNoteSave, onAdminNoteCancel,
  onExpand, onPhotoUpload, isSaving, canPersistAdminNote,
}: {
  task: TaskItem
  onToggleWorker: () => void
  onToggleAdmin: () => void
  onCancel: () => void
  onInteriorToggle: () => void
  onMemoChange: (v: string) => void
  onMemoSave: () => void
  onAdminNoteChange: (v: string) => void
  onAdminNoteEditStart: () => void
  onAdminNoteSave: () => void
  onAdminNoteCancel: () => void
  onExpand: () => void
  onPhotoUpload: (f: File) => void
  isSaving: boolean
  canPersistAdminNote: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const v = task.schedule.vehicle
  const customer = v.customer

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-colors ${
      task.done ? 'border-green-200' : 'border-gray-200'
    }`}>
      {/* 요약 행 */}
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={task.done ? onCancel : onToggleWorker}
          className={`flex-shrink-0 transition-colors ${
            task.done ? 'text-green-500' : 'text-gray-300 hover:text-blue-400'
          }`}
        >
          {task.done ? <CheckCircle2 size={28} /> : <Circle size={28} />}
        </button>

        <div className="flex-1 min-w-0" onClick={onExpand} role="button">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-gray-900 ${task.done ? 'line-through text-gray-400' : ''}`}>
              {v.car_name}
            </span>
            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
              {v.plate_number}
            </span>
            {task.schedule.is_overcount && (
              <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">
                초과
              </span>
            )}
            {task.schedule.has_interior && (
              <span className="flex items-center gap-0.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">
                <Sofa size={10} />
                실내有
              </span>
            )}
            {!task.schedule.has_interior && (v.interior_count ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium border border-green-200">
                <Sofa size={10} />
                실내{v.interior_count}회
              </span>
            )}
            {task.adminNote && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold animate-pulse">
                ⚠️ 지시
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {customer?.name} · {customer?.unit_number} · {CAR_GRADE_LABELS[v.car_grade]}
            {customer?.apartment && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-blue-500 font-medium">
                <Home size={10} />
                {customer.apartment}
              </span>
            )}
          </p>
        </div>

        <button onClick={onExpand} className="text-gray-400 flex-shrink-0">
          {task.expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* 상세 (펼침) */}
      {task.expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">

          {/* 🛋️ 실내 완료 체크 (has_interior=true 이고 미완료일 때만 표시) */}
          {task.schedule.has_interior && !task.done && (
            <button
              onClick={onInteriorToggle}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors ${
                task.interiorDone
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
              }`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                task.interiorDone ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'
              }`}>
                {task.interiorDone && <Check size={12} className="text-white" />}
              </div>
              <Sofa size={16} />
              <div className="text-left">
                <p className="text-sm font-semibold">실내 완료</p>
                <p className="text-xs opacity-70">{task.interiorDone ? `+실내 ${INTERIOR_PRICE.toLocaleString()}원 추가됩니다` : '체크 시 실내 10,000원 추가'}</p>
              </div>
            </button>
          )}

          {/* 관리자 작업지시 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-red-700">⚠️ 관리자 작업지시</p>
              {!task.editingAdminNote && (
                <button
                  onClick={onAdminNoteEditStart}
                  disabled={!canPersistAdminNote}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  {task.adminNote ? '수정' : '+ 작성'}
                </button>
              )}
            </div>
            {task.editingAdminNote ? (
              <div className="flex items-start gap-1.5">
                <textarea
                  autoFocus
                  value={task.adminNote}
                  onChange={e => onAdminNoteChange(e.target.value)}
                  placeholder="관리자 작업지시 내용"
                  rows={2}
                  className="flex-1 text-sm border-2 border-red-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-400 bg-red-50"
                />
                <div className="flex flex-col gap-1">
                  <button
                    onClick={onAdminNoteSave}
                    className="text-white bg-red-500 px-2 py-1 rounded hover:bg-red-600"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    onClick={onAdminNoteCancel}
                    className="text-gray-400 hover:text-gray-600 px-2 py-1"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ) : task.adminNote ? (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg px-3 py-2">
                <p className="text-sm font-semibold text-red-800 whitespace-pre-wrap">{task.adminNote}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-300">
                {canPersistAdminNote ? '작업지시 없음' : 'DB 업데이트 후 사용 가능'}
              </p>
            )}
          </div>

          {/* 작업자 메모 */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-1">작업자 메모</p>
            <textarea
              value={task.memo}
              onChange={e => onMemoChange(e.target.value)}
              placeholder="특이사항, 요청사항 등"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {task.done ? '완료 후 메모 저장 가능' : '완료 처리 시 메모가 함께 저장됩니다'}
              </p>
              <button
                onClick={onMemoSave}
                disabled={!task.done || isSaving}
                className="text-xs text-blue-600 disabled:text-gray-300"
              >
                저장
              </button>
            </div>
          </div>

          {/* 사진 업로드 */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) onPhotoUpload(file)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={task.uploading}
              className="flex items-center gap-2 text-sm text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
            >
              {task.uploading
                ? <Upload size={15} className="animate-bounce" />
                : <Camera size={15} />
              }
              {task.uploading ? '업로드 중...' : '사진 촬영 / 업로드'}
            </button>

            {task.photos.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {task.photos.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`사진 ${i + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                  />
                ))}
              </div>
            )}
          </div>

          {/* 완료 버튼 */}
          {!task.done && (
            <div className="flex gap-2">
              <button
                onClick={onToggleWorker}
                disabled={isSaving}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                  {isSaving ? '처리 중...' : '세차 완료 처리'}
              </button>
              <button
                onClick={onToggleAdmin}
                  disabled={isSaving}
                className="flex-1 bg-gray-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                  {isSaving ? '처리 중...' : '관리자 직접 완료'}
              </button>
            </div>
          )}

          {task.done && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-600 font-medium">
                  ✓ {task.completedBy === 'admin' ? '관리자 직접 완료' : '작업자 완료'}
              </span>
              <button
                onClick={onCancel}
                  disabled={isSaving}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                취소
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
