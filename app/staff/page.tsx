'use client'

import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Home, Check, X, Sofa, CalendarDays, Copy, CheckCheck, Settings } from 'lucide-react'
import Link from 'next/link'
import { createClient, db } from '@/lib/supabase/client'
import { CAR_GRADE_LABELS } from '@/lib/constants/pricing'
import { usePricing, type PriceTable } from '@/lib/hooks/usePricing'
import { getTodayKST } from '@/lib/utils/timezone'
import CompletionModal from '@/components/staff/CompletionModal'
import type { Vehicle, Schedule } from '@/types'

type ScheduleRow = Schedule & {
  admin_memo?: string | null
  vehicle: Vehicle & { customer: { id: string; name: string; apartment: string; unit_number: string | null } }
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
  workerName: string | null
  editingAdminNote: boolean
  assignedWorker: 1 | 2 | 3  // 기본값 1번
}

type ActiveTab = 'all' | 1 | 2 | 3

const TAB_ORDER: ActiveTab[] = ['all', 1, 2, 3]
const WORKER_NAMES_KEY = 'saechachorom_worker_names'
const ASSIGNED_WORKERS_KEY = 'saechachorom_assigned_workers'

export default function StaffPage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const { priceTable } = usePricing()

  const [tasks,        setTasks]        = useState<TaskItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [isMounted,    setIsMounted]    = useState(false)

  const [date,         setDate]         = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('saechachorom_staff_date')
      if (saved) return saved
    }
    return getTodayKST()
  })

  const [schemaSupport, setSchemaSupport] = useState<SchemaSupport | null>(() => {
    try {
      const cached = sessionStorage.getItem('schemaSupport')
      return cached ? (JSON.parse(cached) as SchemaSupport) : null
    } catch { return null }
  })
  const [savingKey,    setSavingKey]    = useState<string | null>(null)
  const [copied,       setCopied]       = useState(false)

  const [activeTab,    setActiveTab]    = useState<ActiveTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('saechachorom_active_tab')
      if (saved === 'all' || saved === '1' || saved === '2' || saved === '3') {
        return saved === 'all' ? 'all' : Number(saved) as ActiveTab
      }
    }
    return 'all'
  })

  // 작업자 이름 설정 (localStorage)
  const [workerNames, setWorkerNames] = useState<Record<1|2|3, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(WORKER_NAMES_KEY)
        if (saved) return JSON.parse(saved) as Record<1|2|3, string>
      } catch {}
    }
    return { 1: '', 2: '', 3: '' }
  })
  const [showSettings, setShowSettings] = useState(false)
  const [editingNames, setEditingNames] = useState<Record<1|2|3, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(WORKER_NAMES_KEY)
        if (saved) return JSON.parse(saved) as Record<1|2|3, string>
      } catch {}
    }
    return { 1: '', 2: '', 3: '' }
  })

  // 클라이언트 마운트 완료
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 스와이프 감지용
  const touchStartXRef = useRef<number | null>(null)

  // 월간 일정/완료 데이터
  const [monthlySchedules,  setMonthlySchedules]  = useState<{ vehicle_id: string; scheduled_date: string }[]>([])
  const [monthlyWashDates,  setMonthlyWashDates]  = useState<{ vehicle_id: string; wash_date: string }[]>([])

  const [completionModalOpen, setCompletionModalOpen] = useState(false)
  const [selectedTaskIdx,     setSelectedTaskIdx]     = useState<number | null>(null)

  // assignedWorker 상태를 localStorage에서 복원
  const restoreAssignedWorkers = useCallback((items: TaskItem[]): TaskItem[] => {
    try {
      const saved = localStorage.getItem(ASSIGNED_WORKERS_KEY)
      if (!saved) return items
      const map = JSON.parse(saved) as Record<string, 1|2|3>
      return items.map(item => ({
        ...item,
        assignedWorker: map[item.schedule.id] ?? 1,
      }))
    } catch { return items }
  }, [])

  // assignedWorker 변경 시 localStorage에 저장
  const persistAssignedWorkers = useCallback((items: TaskItem[]) => {
    try {
      const map: Record<string, 1|2|3> = {}
      items.forEach(t => { map[t.schedule.id] = t.assignedWorker })
      localStorage.setItem(ASSIGNED_WORKERS_KEY, JSON.stringify(map))
    } catch { /* ignore */ }
  }, [])

  function openSettings() {
    setEditingNames({ ...workerNames })
    setShowSettings(true)
  }

  function saveSettings() {
    setWorkerNames(editingNames)
    try { localStorage.setItem(WORKER_NAMES_KEY, JSON.stringify(editingNames)) } catch { /* ignore */ }
    setShowSettings(false)
  }

  // 탭 라벨: 이름 설정 시 이름 표시, 없으면 번호
  function workerLabel(n: 1 | 2 | 3): string {
    return workerNames[n] || `${n}번`
  }

  // ─── 스와이프 핸들러 ───
  function handleTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartXRef.current === null) return
    const diff = touchStartXRef.current - e.changedTouches[0].clientX
    if (Math.abs(diff) < 50) { touchStartXRef.current = null; return }
    const currentIndex = TAB_ORDER.indexOf(activeTab)
    if (diff > 0) {
      // 왼쪽 스와이프 → 다음 탭 (전체→1→2→3)
      const next = TAB_ORDER[currentIndex + 1]
      if (next !== undefined) handleTabChange(next)
    } else {
      // 오른쪽 스와이프 → 이전 탭 (3→2→1→전체)
      const prev = TAB_ORDER[currentIndex - 1]
      if (prev !== undefined) handleTabChange(prev)
    }
    touchStartXRef.current = null
  }

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      localStorage.setItem('saechachorom_active_tab', String(tab))
    }
  }

  function handleDateChange(newDate: string) {
    setDate(newDate)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('saechachorom_staff_date', newDate)
    }
  }

  const detectSchemaSupport = useCallback(async () => {
    const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
      supabase.from('schedules').select('id, admin_memo').limit(1),
      supabase.from('wash_records').select('id, admin_note').limit(1),
      supabase.from('wash_records').select('id, completed_by').limit(1),
    ])
    const support = { scheduleAdminMemo: !e1, washAdminNote: !e2, washCompletedBy: !e3 }
    try { sessionStorage.setItem('schemaSupport', JSON.stringify(support)) } catch { /* ignore */ }
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
      ? '*, vehicle:vehicles(*, customer:customers(id, name, apartment, unit_number)), admin_memo'
      : '*, vehicle:vehicles(*, customer:customers(id, name, apartment, unit_number))'

    const washCols = ['id', 'vehicle_id', 'schedule_id', 'memo']
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

    const recordRows = (records ?? []) as Array<{ id: string; vehicle_id: string; schedule_id: string | null; memo: string | null; admin_note: string | null; completed_by: string | null }>

    const items: TaskItem[] = rows.map(s => {
      // schedule_id로 정확히 매칭 (같은 차량의 실외/실내만 스케줄을 독립적으로 처리)
      const record = recordRows.find(r => r.schedule_id === s.id)
        ?? recordRows.find(r => !r.schedule_id && r.vehicle_id === s.vehicle_id)
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
        assignedWorker:   1,  // 기본값 (나중에 복원됨)
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

    const restoredItems = restoreAssignedWorkers(items)
    setTasks(restoredItems)
    setLoading(false)
  }, [date, detectSchemaSupport, restoreAssignedWorkers, schemaSupport, supabase])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  function updateTask(idx: number, patch: Partial<TaskItem>) {
    setTasks(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t))
  }

  // 작업자 배정: 1번은 항상 누르면 1번 / 2·3번은 현재 번호면 1번으로 복귀
  function assignWorker(idx: number, n: 1 | 2 | 3) {
    const task = tasks[idx]
    const next: 1 | 2 | 3 = (task.assignedWorker === n && n !== 1) ? 1 : n
    const newTasks = tasks.map((t, i) => i === idx ? { ...t, assignedWorker: next } : t)
    setTasks(newTasks)
    persistAssignedWorkers(newTasks)
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

  // 작업보고 텍스트 생성 (카카오톡 형식) — 현재 탭에 맞는 차량만 포함
  const buildReportText = useCallback((sourceTasks: TaskItem[], tab: ActiveTab) => {
    if (!date || sourceTasks.length === 0) return ''

    // 탭에 따라 필터링
    const filteredTasks = tab === 'all'
      ? sourceTasks
      : sourceTasks.filter(t => t.assignedWorker === tab)

    if (filteredTasks.length === 0) return ''

    const d = new Date(date + 'T00:00:00')
    const workerSuffix = tab !== 'all' ? ` (${workerNames[tab] || `${tab}번`})` : ''
    const header = `${d.getMonth() + 1}.${d.getDate()} 작업차량${workerSuffix}`
    const lines: string[] = [header]
    let interiorAddCount = 0

    const regularTasks    = filteredTasks.filter(t => (t.schedule as unknown as { schedule_type?: string }).schedule_type !== 'interior_only')
    const interiorOnlyTasks = filteredTasks.filter(t => (t.schedule as unknown as { schedule_type?: string }).schedule_type === 'interior_only')

    // 아파트 이름에서 동/숫자 제거 (예: "서한이다음 621동" → "서한이다음")
    const baseApt = (apt: string) => apt.replace(/\s*\d+동?\s*$/, '').trim() || apt

    // 일반 외부세차 — 아파트 기본명으로 그룹핑
    const grouped: { apt: string; items: typeof regularTasks }[] = []
    regularTasks.forEach(t => {
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
          interiorAddCount++
        }
      })
    })

    // 실내만 작업 — 별도 섹션
    if (interiorOnlyTasks.length > 0) {
      lines.push('')
      lines.push('[실내작업]')
      interiorOnlyTasks.forEach(t => {
        const v = t.schedule.vehicle
        const unit = v.customer?.unit_number ? ` (${v.customer.unit_number})` : ''
        lines.push(`${v.car_name} - ${v.plate_number}${unit}`)
      })
    }

    const outdoor = regularTasks.length
    const total = outdoor + interiorAddCount + interiorOnlyTasks.length
    lines.push('')
    lines.push(`${total}대`)
    lines.push(`실외${outdoor}`)
    if (interiorAddCount > 0) lines.push(`실내${interiorAddCount}`)
    if (interiorOnlyTasks.length > 0) lines.push(`실내만${interiorOnlyTasks.length}`)
    return lines.join('\n')
  }, [date, workerNames])

  const reportText = useMemo(
    () => buildReportText(tasks, activeTab),
    [buildReportText, tasks, activeTab]
  )

  function copyReport() {
    if (!reportText) return
    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // 탭에 따른 필터링
  const displayTasks = activeTab === 'all'
    ? tasks
    : tasks.filter(t => t.assignedWorker === activeTab)

  const completedCount = displayTasks.filter(t => t.done).length

  const tabItems: { key: ActiveTab; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 1,     label: workerLabel(1) },
    { key: 2,     label: workerLabel(2) },
    { key: 3,     label: workerLabel(3) },
  ]

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="text-gray-400 text-sm">페이지 로딩 중...</div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gray-50"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">작업 현황</h1>
            <p className="text-xs text-gray-400">새차처럼 세차 서비스</p>
          </div>
          <div className="flex items-center gap-2">
            {/* 작업자 이름 설정 버튼 */}
            <button
              onClick={openSettings}
              className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
              title="작업자 이름 설정"
            >
              <Settings size={16} />
            </button>
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
                onChange={e => handleDateChange(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700"
              />
              <p className="text-xs text-gray-500 mt-0.5">
                {completedCount} / {displayTasks.length} 완료
              </p>
            </div>
          </div>
        </div>

        {/* ─── 탭 바 (전체 / 1 / 2 / 3) ─── */}
        <div className="max-w-lg mx-auto flex border-t border-gray-100">
          {tabItems.map(({ key, label }) => (
            <button
              key={String(key)}
              onClick={() => handleTabChange(key)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-400 hover:text-gray-600 bg-white'
              }`}
            >
              {label}
              {key !== 'all' && (
                <span className={`ml-1 text-xs ${
                  activeTab === key ? 'text-blue-400' : 'text-gray-300'
                }`}>
                  ({tasks.filter(t => t.assignedWorker === key).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {displayTasks.length > 0 && (
          <div className="h-1 bg-gray-100">
            <div className="h-1 bg-blue-500 transition-all" style={{ width: `${(completedCount / displayTasks.length) * 100}%` }} />
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
        ) : displayTasks.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            {activeTab === 'all'
              ? <p className="text-sm">오늘 예약된 차량이 없습니다</p>
              : <p className="text-sm">{workerLabel(activeTab as 1|2|3)} 작업자에게 배정된 차량이 없습니다</p>
            }
          </div>
        ) : (
          <div className="space-y-3">
            {displayTasks.map((task) => {
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
                  priceTable={priceTable}
                  workerNames={workerNames}
                  isSaving={savingKey === `done:${task.schedule.id}` || savingKey === `admin:${task.schedule.id}` || savingKey === `memo:${task.schedule.id}`}
                  canPersistAdminNote={!!schemaSupport?.scheduleAdminMemo || !!schemaSupport?.washAdminNote}
                  monthlyDates={vSchedules}
                  monthlyWashSet={vWashSet}
                  onToggleWorker={() => { setSelectedTaskIdx(idx); setCompletionModalOpen(true) }}
                  onCancel={() => toggleDone(idx)}
                  onAssignWorker={(n) => assignWorker(idx, n)}
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
          customer={{
            id: tasks[selectedTaskIdx].schedule.vehicle.customer.id,
            name: tasks[selectedTaskIdx].schedule.vehicle.customer.name,
            apartment: tasks[selectedTaskIdx].schedule.vehicle.customer.apartment,
            unit_number: tasks[selectedTaskIdx].schedule.vehicle.customer.unit_number,
          }}
          scheduled_date={tasks[selectedTaskIdx].schedule.scheduled_date}
          schedule_id={tasks[selectedTaskIdx].schedule.id}
          isInteriorOnly={(tasks[selectedTaskIdx].schedule as unknown as { schedule_type?: string }).schedule_type === 'interior_only'}
          hasInterior={!!tasks[selectedTaskIdx].schedule.has_interior}
          onSuccess={() => {
            setCompletionModalOpen(false)
            setSelectedTaskIdx(null)
            fetchTasks()
          }}
        />
      )}

      {/* ─── 작업자 이름 설정 모달 ─── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowSettings(false)}>
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl p-6 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">작업자 이름 설정</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {([1, 2, 3] as const).map(n => (
                <div key={n} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    n === 1 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {n}
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={editingNames[n]}
                      onChange={e => setEditingNames(prev => ({ ...prev, [n]: e.target.value }))}
                      placeholder={`${n}번 작업자 이름 (예: 홍길동)`}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  {n === 1 && (
                    <span className="text-xs text-blue-500 font-medium flex-shrink-0">기본</span>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 mb-4">
              이름을 입력하면 탭에 이름이 표시됩니다. 비워두면 번호로 표시됩니다.
            </p>

            <button
              onClick={saveSettings}
              className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── 작업 카드 ─── */
const TaskCard = memo(function TaskCard({
  task, priceTable, workerNames, onToggleWorker, onCancel,
  onAssignWorker, onInteriorToggle,
  onMemoChange, onMemoSave, onAdminNoteChange,
  onAdminNoteEditStart, onAdminNoteSave, onAdminNoteCancel,
  onExpand, isSaving, canPersistAdminNote,
  monthlyDates, monthlyWashSet,
}: {
  task: TaskItem
  priceTable: PriceTable
  workerNames: Record<1|2|3, string>
  onToggleWorker: () => void
  onCancel: () => void
  onAssignWorker: (n: 1 | 2 | 3) => void
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

        {/* 작업자 배정 버튼 1 / 2 / 3 */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <button onClick={onExpand} className="text-gray-400">
            {task.expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <div className="flex gap-1">
            {([1, 2, 3] as const).map(n => {
              const isActive = task.assignedWorker === n
              const name = workerNames[n]
              return (
                <button
                  key={n}
                  onClick={() => onAssignWorker(n)}
                  title={name || `${n}번 작업자`}
                  className={`min-w-[28px] h-7 px-1.5 rounded-full border text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-blue-500 border-blue-500 text-white shadow-sm scale-110'
                      : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-400'
                  }`}
                >
                  {name ? name.slice(0, 1) : n}
                </button>
              )
            })}
          </div>
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
})
