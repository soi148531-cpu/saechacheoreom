'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Home, Check, X, Sofa, CalendarDays, Copy, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { createClient, db } from '@/lib/supabase/client'
import { CAR_GRADE_LABELS } from '@/lib/constants/pricing'
import { usePricing } from '@/lib/hooks/usePricing'
import { getTodayKST } from '@/lib/utils/timezone'
import CompletionModal from '@/components/staff/CompletionModal'
import type { Vehicle, Schedule } from '@/types'

type ScheduleRow = Schedule & {
  admin_memo?: string | null
  vehicle: Vehicle & { customer: { name: string; apartment: string; unit_number: string | null } }
}

type SchemaSupport = {
  scheduleAdminMemo: boolean
  washAdminNote: boolean
  washCompletedBy: boolean
}

interface TaskItem {
  schedule: ScheduleRow
  done: boolean
  memo: string
  adminNote: string
  completedBy: 'worker' | 'admin' | null
  interiorDone: boolean
  expanded: boolean
  washRecordId: string | null
  workerName: string | null   // 실제 작업자 이름
  editingAdminNote: boolean
  selfWork: boolean  // 사장이 직접 작업 → 카톡 복사 제외
  skipped: boolean   // 보류 처리 → 하단 보류 섹션으로 이동
}

export default function StaffPage() {
  const supabase = createClient()
  const { priceTable } = usePricing()

  const [tasks,        setTasks]        = useState<TaskItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [date,         setDate]         = useState<string | null>(null)
  const [schemaSupport, setSchemaSupport] = useState<SchemaSupport | null>(null)
  const [savingKey,    setSavingKey]    = useState<string | null>(null)
  const [copied,       setCopied]       = useState(false)
  const [skippedOpen,  setSkippedOpen]  = useState(false)

  // 월간 일정/완료 데이터
  const [monthlySchedules,  setMonthlySchedules]  = useState<{ vehicle_id: string; scheduled_date: string }[]>([])
  const [monthlyWashDates,  setMonthlyWashDates]  = useState<{ vehicle_id: string; wash_date: string }[]>([])

  const [completionModalOpen, setCompletionModalOpen] = useState(false)
  const [selectedTaskIdx,     setSelectedTaskIdx]     = useState<number | null>(null)

  useEffect(() => {
    const fetchServerTime = async () => {
      try {
        const res = await fetch('/api/time/now')
        const result = await res.json()
        setDate(result.success ? result.today : getTodayKST())
      } catch {
        setDate(getTodayKST())
      }
    }
    fetchServerTime()
  }, [])

  const detectSchemaSupport = useCallback(async () => {
    const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
      supabase.from('schedules').select('id, admin_memo').limit(1),
      supabase.from('wash_records').select('id, admin_note').limit(1),
      supabase.from('wash_records').select('id, completed_by').limit(1),
    ])
    const support = { scheduleAdminMemo: !e1, washAdminNote: !e2, washCompletedBy: !e3 }
    setSchemaSupport(prev =>
      prev?.scheduleAdminMemo === support.scheduleAdminMemo &&
      prev?.washAdminNote === support.washAdminNote &&
      prev?.washCompletedBy === support.washCompletedBy ? prev : support
    )
    return support
  }, [supabase])

  const fetchTasks = useCallback(async () => {
    if (!date) { setLoading(false); return }
    setLoading(true)

    const support = schemaSupport ?? await detectSchemaSupport()
    const scheduleSelect = support.scheduleAdminMemo
      ? '*, vehicle:vehicles(*, customer:customers(name, apartment, unit_number)), admin_memo'
      : '*, vehicle:vehicles(*, customer:customers(name, apartment, unit_number))'

    const washCols = ['id', 'vehicle_id', 'memo']
    if (support.washAdminNote) washCols.push('admin_note')
    if (support.washCompletedBy) washCols.push('completed_by')

    const { data: schedules, error } = await supabase
      .from('schedules')
      .select(scheduleSelect)
      .eq('scheduled_date', date)
      .eq('is_deleted', false)
      .order('created_at')

    if (error || !schedules) { setLoading(false); return }

    const rows = schedules as ScheduleRow[]
    const vehicleIds = rows.map(s => s.vehicle_id)

    // 이번달 시작/끝
    const [year, month] = date.split('-')
    const startDate = `${year}-${month}-01`
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

    const [{ data: records }, { data: mSched }, { data: mWash }] = await Promise.all([
      vehicleIds.length > 0
        ? supabase.from('wash_records').select(washCols.join(',')).in('vehicle_id', vehicleIds).eq('wash_date', date)
        : { data: [] },
      vehicleIds.length > 0
        ? supabase.from('schedules').select('vehicle_id, scheduled_date')
            .in('vehicle_id', vehicleIds)
            .gte('scheduled_date', startDate)
            .lte('scheduled_date', endDate)
            .eq('is_deleted', false)
        : { data: [] },
      vehicleIds.length > 0
        ? supabase.from('wash_records').select('vehicle_id, wash_date')
            .in('vehicle_id', vehicleIds)
            .gte('wash_date', startDate)
            .lte('wash_date', endDate)
        : { data: [] },
    ])

    setMonthlySchedules((mSched ?? []) as { vehicle_id: string; scheduled_date: string }[])
    setMonthlyWashDates((mWash ?? []) as { vehicle_id: string; wash_date: string }[])

    const recordRows = (records ?? []) as Array<{ id: string; vehicle_id: string; memo: string | null; admin_note: string | null; completed_by: string | null }>

    const items: TaskItem[] = rows.map(s => {
      const record = recordRows.find(r => r.vehicle_id === s.vehicle_id)
      const basePrice = (s.vehicle as ScheduleRow['vehicle']).unit_price ?? 0
      const prevInteriorDone = record
        ? ((record as unknown as { price?: number }).price ?? 0) - basePrice > 0
        : s.has_interior
      return {
        schedule:         s as ScheduleRow,
        done:             !!record,
        memo:             record?.memo ?? '',
        adminNote:        s.admin_memo ?? record?.admin_note ?? '',
        completedBy:      (record?.completed_by as 'worker' | 'admin' | null) ?? null,
        interiorDone:     prevInteriorDone,
        expanded:         !record,
        washRecordId:     record?.id ?? null,
        workerName:       record?.completed_by ?? null,
        editingAdminNote: false,
        selfWork:         false,
        skipped:          false,
      }
    })

    items.sort((a, b) => {
      const va = a.schedule.vehicle, vb = b.schedule.vehicle
      const aptA = va.customer?.apartment ?? ''
      const aptB = vb.customer?.apartment ?? ''
      if (aptA !== aptB) return aptA.localeCompare(aptB, 'ko')
      // 동호수: 숫자 추출해서 정렬
      const unitA = va.customer?.unit_number ?? ''
      const unitB = vb.customer?.unit_number ?? ''
      const numA = parseInt(unitA.replace(/\D/g, '') || '0')
      const numB = parseInt(unitB.replace(/\D/g, '') || '0')
      if (numA !== numB) return numA - numB
      // 같은 고객이면 created_at 순
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
        if (error) { alert('완료 취소 실패: ' + error.message); setSavingKey(null); return }
      }
      updateTask(idx, { done: false, washRecordId: null, completedBy: null })
      setSavingKey(null)
    } else {
      if (support.scheduleAdminMemo) {
        await db().from('schedules').update({ admin_memo: task.adminNote.trim() || null }).eq('id', task.schedule.id)
      }
      const hasInterior = task.schedule.has_interior && task.interiorDone
      const payload: Record<string, unknown> = {
        vehicle_id:  v.id,
        schedule_id: task.schedule.id,
        wash_date:   date,
        price:       (v.unit_price ?? 0) + (hasInterior ? priceTable.interior : 0),
        is_completed: true,
        memo:         task.memo.trim() || null,
      }
      if (support.washAdminNote) payload.admin_note = task.adminNote.trim() || null
      if (support.washCompletedBy) payload.completed_by = completedBy

      const { data: rec, error } = await db().from('wash_records').insert(payload).select().single()
      if (error) { alert('완료 처리 실패: ' + error.message); setSavingKey(null); return }
      if (rec) updateTask(idx, { done: true, washRecordId: rec.id, completedBy, expanded: false })
      setSavingKey(null)
    }
  }

  async function saveAdminNote(idx: number) {
    const task = tasks[idx]
    const support = schemaSupport ?? await detectSchemaSupport()
    setSavingKey(`admin:${task.schedule.id}`)
    if (support.scheduleAdminMemo) {
      const { error } = await db().from('schedules').update({ admin_memo: task.adminNote.trim() || null }).eq('id', task.schedule.id)
      if (error) { alert('저장 실패: ' + error.message); setSavingKey(null); return }
    }
    if (task.washRecordId && support.washAdminNote) {
      await db().from('wash_records').update({ admin_note: task.adminNote.trim() || null }).eq('id', task.washRecordId)
    }
    updateTask(idx, { editingAdminNote: false })
    setSavingKey(null)
  }

  async function saveWorkerMemo(idx: number) {
    const task = tasks[idx]
    if (!task.washRecordId) { alert('완료 처리 후 저장 가능합니다.'); return }
    setSavingKey(`memo:${task.schedule.id}`)
    const { error } = await db().from('wash_records').update({ memo: task.memo.trim() || null }).eq('id', task.washRecordId)
    if (error) alert('메모 저장 실패: ' + error.message)
    setSavingKey(null)
  }

  // 작업보고 텍스트 생성 (카카오톡 형식)
  const reportText = useMemo(() => {
    if (!date || tasks.length === 0) return ''
    const d = new Date(date + 'T00:00:00')
    const header = `${d.getMonth() + 1}.${d.getDate()} 작업차량`
    const lines: string[] = [header]
    let interiorCount = 0
    const workerTasks = tasks.filter(t => !t.selfWork && !t.skipped)

    // 아파트 이름에서 동/숫자 제거 (예: "서한이다음 621동" → "서한이다음")
    const baseApt = (apt: string) => apt.replace(/\s*\d+동?\s*$/, '').trim() || apt

    // 아파트 기본명으로 그룹핑
    const grouped: { apt: string; items: typeof workerTasks }[] = []
    workerTasks.forEach(t => {
      const apt = baseApt(t.schedule.vehicle.customer?.apartment ?? '기타')
      const group = grouped.find(g => g.apt === apt)
      if (group) group.items.push(t)
      else grouped.push({ apt, items: [t] })
    })

    grouped.forEach(({ apt, items }) => {
      lines.push('')
      lines.push(`[${apt}]`)
      items.forEach(t => {
        const v = t.schedule.vehicle
        lines.push(`${v.car_name} - ${v.plate_number}`)
        if (t.schedule.has_interior) {
          lines.push('내부')
          interiorCount++
        }
      })
    })

    const outdoor = workerTasks.length
    const total = outdoor + interiorCount
    lines.push('')
    lines.push(`${total}대`)
    lines.push(`실외${outdoor}`)
    lines.push(`실내${interiorCount}`)
    return lines.join('\n')
  }, [date, tasks])

  function copyReport() {
    if (!reportText) return
    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const activeTasks  = tasks.filter(t => !t.skipped)
  const skippedTasks = tasks.filter(t => t.skipped)
  const completedCount = activeTasks.filter(t => t.done).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">작업 현황</h1>
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
                value={date || ''}
                onChange={e => setDate(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700"
              />
              <p className="text-xs text-gray-500 mt-0.5">
                {completedCount} / {activeTasks.length} 완료{skippedTasks.length > 0 && ` (보류 ${skippedTasks.length})`}
              </p>
            </div>
          </div>
        </div>
        {activeTasks.length > 0 && (
          <div className="h-1 bg-gray-100">
            <div className="h-1 bg-blue-500 transition-all" style={{ width: `${(completedCount / activeTasks.length) * 100}%` }} />
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* 작업보고 복사 버튼 */}
        {tasks.length > 0 && (
          <button
            onClick={copyReport}
            className={`w-full mb-3 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
              copied
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
            {copied ? '복사 완료!' : '작업보고 복사 (카톡용)'}
          </button>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">불러오는 중...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">오늘 예약된 차량이 없습니다</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {activeTasks.map((task) => {
                const idx = tasks.indexOf(task)
                const vId = task.schedule.vehicle_id
                const vSchedules = monthlySchedules
                  .filter(s => s.vehicle_id === vId)
                  .map(s => s.scheduled_date)
                  .sort()
                const vWashSet = new Set(
                  monthlyWashDates.filter(w => w.vehicle_id === vId).map(w => w.wash_date)
                )
                return (
                  <TaskCard
                    key={task.schedule.id}
                    task={task}
                    isSaving={savingKey === `done:${task.schedule.id}` || savingKey === `admin:${task.schedule.id}` || savingKey === `memo:${task.schedule.id}`}
                    canPersistAdminNote={!!schemaSupport?.scheduleAdminMemo || !!schemaSupport?.washAdminNote}
                    monthlyDates={vSchedules}
                    monthlyWashSet={vWashSet}
                    onToggleWorker={() => { setSelectedTaskIdx(idx); setCompletionModalOpen(true) }}
                    onCancel={() => toggleDone(idx)}
                    onSelfWorkToggle={() => updateTask(idx, { selfWork: !task.selfWork })}
                    onSkip={() => updateTask(idx, { skipped: true, expanded: false })}
                    onInteriorToggle={() => updateTask(idx, { interiorDone: !task.interiorDone })}
                    onMemoChange={v => updateTask(idx, { memo: v })}
                    onMemoSave={() => saveWorkerMemo(idx)}
                    onAdminNoteChange={v => updateTask(idx, { adminNote: v })}
                    onAdminNoteEditStart={() => updateTask(idx, { editingAdminNote: true })}
                    onAdminNoteSave={() => saveAdminNote(idx)}
                    onAdminNoteCancel={() => updateTask(idx, { editingAdminNote: false })}
                    onExpand={() => updateTask(idx, { expanded: !task.expanded })}
                  />
                )
              })}
            </div>

            {/* 보류 섹션 */}
            {skippedTasks.length > 0 && (
              <div className="mt-4 border border-dashed border-gray-300 rounded-xl overflow-hidden">
                <button
                  onClick={() => setSkippedOpen(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">⏸</span>
                    보류 {skippedTasks.length}건 (차량 못 찾음 등)
                  </span>
                  <span className="text-gray-400">{skippedOpen ? '▲' : '▼'}</span>
                </button>
                {skippedOpen && (
                  <div className="divide-y divide-gray-100">
                    {skippedTasks.map((task) => {
                      const idx = tasks.indexOf(task)
                      const v = task.schedule.vehicle
                      return (
                        <div key={task.schedule.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-gray-500">{v.car_name}</span>
                              <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{v.plate_number}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {v.customer?.name} · {v.customer?.apartment}
                            </p>
                          </div>
                          <button
                            onClick={() => updateTask(idx, { skipped: false, expanded: false })}
                            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 font-medium transition-colors"
                          >
                            복원
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {completionModalOpen && selectedTaskIdx !== null && (
        <CompletionModal
          isOpen={completionModalOpen}
          onClose={() => setCompletionModalOpen(false)}
          vehicle={{
            id: tasks[selectedTaskIdx].schedule.vehicle.id,
            car_name: tasks[selectedTaskIdx].schedule.vehicle.car_name,
            plate_number: tasks[selectedTaskIdx].schedule.vehicle.plate_number,
            unit_price: tasks[selectedTaskIdx].schedule.vehicle.unit_price || 0,
          }}
          customer={tasks[selectedTaskIdx].schedule.vehicle.customer}
          scheduled_date={tasks[selectedTaskIdx].schedule.scheduled_date}
          schedule_id={tasks[selectedTaskIdx].schedule.id}
          onSuccess={() => {
            setCompletionModalOpen(false)
            setSelectedTaskIdx(null)
            fetchTasks()
          }}
        />
      )}
    </div>
  )
}

/* ─── 작업 카드 ─── */
function TaskCard({
  task, onToggleWorker, onCancel,
  onSelfWorkToggle, onSkip, onInteriorToggle,
  onMemoChange, onMemoSave, onAdminNoteChange,
  onAdminNoteEditStart, onAdminNoteSave, onAdminNoteCancel,
  onExpand, isSaving, canPersistAdminNote,
  monthlyDates, monthlyWashSet,
}: {
  task: TaskItem
  onToggleWorker: () => void
  onCancel: () => void
  onSelfWorkToggle: () => void
  onSkip: () => void
  onInteriorToggle: () => void
  onMemoChange: (v: string) => void
  onMemoSave: () => void
  onAdminNoteChange: (v: string) => void
  onAdminNoteEditStart: () => void
  onAdminNoteSave: () => void
  onAdminNoteCancel: () => void
  onExpand: () => void
  isSaving: boolean
  canPersistAdminNote: boolean
  monthlyDates: string[]
  monthlyWashSet: Set<string>
}) {
  const { priceTable } = usePricing()
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
          className={`flex-shrink-0 transition-colors ${task.done ? 'text-green-500' : 'text-gray-300 hover:text-blue-400'}`}
        >
          {task.done ? <CheckCircle2 size={28} /> : <Circle size={28} />}
        </button>

        <div className="flex-1 min-w-0" onClick={onExpand} role="button">
          {/* 차량명 + 번호판 + 배지 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-gray-900 ${task.done ? 'line-through text-gray-400' : ''}`}>
              {v.car_name}
            </span>
            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
              {v.plate_number}
            </span>
            {task.schedule.is_overcount && (
              <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">초과</span>
            )}
            {task.schedule.has_interior && (
              <span className="flex items-center gap-0.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">
                <Sofa size={10} />실내有
              </span>
            )}
            {!task.schedule.has_interior && (v.interior_count ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium border border-green-200">
                <Sofa size={10} />실내{v.interior_count}회
              </span>
            )}
            {task.done && task.workerName && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                {task.workerName}
              </span>
            )}
            {task.adminNote && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">⚠️ 지시</span>
            )}
          </div>
          {/* 고객 정보 */}
          <p className="text-xs text-gray-500 mt-0.5">
            {customer?.name} · {customer?.unit_number} · {CAR_GRADE_LABELS[v.car_grade]}
            {customer?.apartment && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-blue-500 font-medium">
                <Home size={10} />{customer.apartment}
              </span>
            )}
          </p>
          {/* 이번달 예정일 배지 */}
          {monthlyDates.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {monthlyDates.map(d => {
                const isDone = monthlyWashSet.has(d)
                const isToday = d === task.schedule.scheduled_date
                const label = `${Number(d.split('-')[1])}/${Number(d.split('-')[2])}`
                return (
                  <span key={d} className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    isDone
                      ? 'bg-green-100 text-green-600 line-through opacity-60'
                      : isToday
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-600'
                  }`}>
                    {isDone ? `✓${label}` : label}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <button onClick={onExpand} className="text-gray-400">
            {task.expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <button
            onClick={onSelfWorkToggle}
            className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
              task.selfWork
                ? 'bg-amber-100 border-amber-300 text-amber-700'
                : 'bg-gray-50 border-gray-200 text-gray-400'
            }`}
          >
            {task.selfWork ? '직접✓' : '직접'}
          </button>
          {!task.done && (
            <button
              onClick={onSkip}
              className="text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-400 font-medium transition-colors"
            >
              보류
            </button>
          )}
        </div>
      </div>

      {/* 상세 (펼침) */}
      {task.expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">

          {/* 실내 완료 체크 */}
          {task.schedule.has_interior && !task.done && (
            <button
              onClick={onInteriorToggle}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors ${
                task.interiorDone ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500'
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
                <p className="text-xs opacity-70">
                  {task.interiorDone ? `+실내 ${priceTable.interior.toLocaleString()}원 추가` : `체크 시 실내 ${priceTable.interior.toLocaleString()}원 추가`}
                </p>
              </div>
            </button>
          )}

          {/* 관리자 작업지시 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-red-700">⚠️ 관리자 작업지시</p>
              {!task.editingAdminNote && (
                <button onClick={onAdminNoteEditStart} disabled={!canPersistAdminNote} className="text-xs text-red-600 hover:text-red-700">
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
                  <button onClick={onAdminNoteSave} className="text-white bg-red-500 px-2 py-1 rounded hover:bg-red-600"><Check size={13} /></button>
                  <button onClick={onAdminNoteCancel} className="text-gray-400 hover:text-gray-600 px-2 py-1"><X size={13} /></button>
                </div>
              </div>
            ) : task.adminNote ? (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg px-3 py-2">
                <p className="text-sm font-semibold text-red-800 whitespace-pre-wrap">{task.adminNote}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-300">작업지시 없음</p>
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
              <p className="text-xs text-gray-400">{task.done ? '완료 후 메모 수정 가능' : '완료 처리 시 함께 저장됩니다'}</p>
              <button onClick={onMemoSave} disabled={!task.done || isSaving} className="text-xs text-blue-600 disabled:text-gray-300">저장</button>
            </div>
          </div>

          {/* 완료 버튼 */}
          {!task.done ? (
            <button
              onClick={onToggleWorker}
              disabled={isSaving}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              {isSaving ? '처리 중...' : '세차 완료 처리'}
            </button>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-600 font-medium">✓ 완료</span>
              <button onClick={onCancel} disabled={isSaving} className="text-xs text-gray-400 hover:text-red-500 transition-colors">취소</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
