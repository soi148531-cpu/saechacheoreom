'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Search, X, AlertTriangle, CheckCircle2, Circle, Trash2, Home, Edit2, Check, Sofa, Plus, GripVertical } from 'lucide-react'
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient, db } from '@/lib/supabase/client'
import type { Vehicle, Schedule } from '@/types'

type ScheduleWithVehicle = Schedule & {
  has_interior?: boolean
  vehicle: Vehicle & { customer: { name: string; apartment: string } }
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function CalendarPage() {
  const supabase = createClient()

  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const [schedules,    setSchedules]    = useState<ScheduleWithVehicle[]>([])
  const [vehicles,     setVehicles]     = useState<(Vehicle & { customer?: { name: string; apartment: string } })[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [showAddForm,      setShowAddForm]      = useState(false)
  const [addVehicleSearch, setAddVehicleSearch] = useState('')
  const [reorderMode,      setReorderMode]      = useState(false)
  const [manualOrder,      setManualOrder]      = useState<string[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay   = new Date(year, month + 1, 0).getDate()
    const endDate   = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const [{ data: scheduleData }, { data: vehicleData }] = await Promise.all([
      supabase
        .from('schedules')
        .select('*, vehicle:vehicles(*, customer:customers(name, apartment))')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .eq('is_deleted', false)
        .order('scheduled_date'),
      supabase
        .from('vehicles')
        .select('*, customer:customers(name, apartment)')
        .neq('status', 'unregistered')
    ])

    setSchedules((scheduleData ?? []) as ScheduleWithVehicle[])
    setVehicles((vehicleData ?? []) as Vehicle[])
    setLoading(false)
  }, [year, month, supabase])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])
  useEffect(() => {
    setShowAddForm(false)
    setAddVehicleSearch('')
    setReorderMode(false)
    setManualOrder([])
  }, [selectedDate])

  const byDate = useMemo(() => {
    const map: Record<string, ScheduleWithVehicle[]> = {}
    schedules.forEach(s => {
      if (!map[s.scheduled_date]) map[s.scheduled_date] = []
      map[s.scheduled_date].push(s)
    })
    return map
  }, [schedules])

  const searchHighlights = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>()
    const q = searchQuery.trim().toLowerCase()
    const matched = schedules.filter(s =>
      s.vehicle?.plate_number?.toLowerCase().includes(q) ||
      s.vehicle?.car_name?.toLowerCase().includes(q)
    )
    return new Set(matched.map(s => s.scheduled_date))
  }, [schedules, searchQuery])

  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`

  const regularVehicles = useMemo(() => {
    return vehicles.filter(v =>
      v.monthly_count !== 'onetime' &&
      (v.status === 'active' || v.status === 'paused') &&
      v.start_date <= monthEnd &&
      (!v.end_date || v.end_date >= monthStart)
    )
  }, [vehicles, monthStart, monthEnd])

  const calendarDays = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay()
    const lastDay  = new Date(year, month + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= lastDay; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [year, month])

  function changeMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setSelectedDate(null)
  }

  function formatDateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  async function deleteSchedule(scheduleId: string) {
    await db().from('schedules').update({ is_deleted: true }).eq('id', scheduleId)
    fetchSchedules()
  }

  async function changeScheduleDate(scheduleId: string, newDate: string) {
    await db().from('schedules').update({ scheduled_date: newDate }).eq('id', scheduleId)
    fetchSchedules()
  }

  async function toggleInterior(scheduleId: string, current: boolean) {
    await db().from('schedules').update({ has_interior: !current }).eq('id', scheduleId)
    fetchSchedules()
  }

  async function addOnetimeSchedule(vehicleId: string) {
    if (!selectedDate) return
    await db().from('schedules').insert({
      vehicle_id: vehicleId,
      scheduled_date: selectedDate,
      schedule_type: 'onetime',
      is_overcount: false,
      is_deleted: false,
    })
    setShowAddForm(false)
    setAddVehicleSearch('')
    fetchSchedules()
  }

  function toggleReorderMode() {
    if (!reorderMode) {
      setManualOrder(selectedSchedules.map(s => s.id))
    }
    setReorderMode(v => !v)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = manualOrder.indexOf(active.id as string)
    const newIndex = manualOrder.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return
    const newOrder = arrayMove(manualOrder, oldIndex, newIndex)
    setManualOrder(newOrder)
    await Promise.all(
      newOrder.map((id, idx) =>
        db().from('schedules').update({ sort_order: (idx + 1) * 10 }).eq('id', id)
      )
    )
  }

  const selectedSchedules = useMemo(() => {
    const list = selectedDate ? (byDate[selectedDate] ?? []) : []
    const hasSortOrder = list.some(s => s.sort_order != null)
    if (hasSortOrder) {
      return [...list].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))
    }
    return [...list].sort((a, b) => {
      const aptA = a.vehicle?.customer?.apartment ?? ''
      const aptB = b.vehicle?.customer?.apartment ?? ''
      if (aptA !== aptB) return aptA.localeCompare(aptB, 'ko')
      const unitA = a.vehicle?.unit_number ?? ''
      const unitB = b.vehicle?.unit_number ?? ''
      return unitA.localeCompare(unitB, 'ko')
    })
  }, [selectedDate, byDate])

  const displayedSchedules = useMemo(() => {
    if (reorderMode && manualOrder.length > 0) {
      const map = new Map(selectedSchedules.map(s => [s.id, s]))
      return manualOrder.map(id => map.get(id)).filter(Boolean) as ScheduleWithVehicle[]
    }
    return selectedSchedules
  }, [reorderMode, manualOrder, selectedSchedules])

  const filteredAddVehicles = useMemo(() => {
    if (!addVehicleSearch.trim()) return vehicles.slice(0, 10)
    const q = addVehicleSearch.toLowerCase()
    return vehicles.filter(v =>
      v.plate_number?.toLowerCase().includes(q) ||
      v.car_name?.toLowerCase().includes(q) ||
      v.unit_number?.toLowerCase().includes(q) ||
      v.customer?.name?.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [vehicles, addVehicleSearch])
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

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

          {searchActive ? (
            <div className="flex items-center gap-1 flex-1">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="차량번호 / 차량명"
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button
                onClick={() => { setSearchActive(false); setSearchQuery('') }}
                className="p-1.5 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchActive(true)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 border border-gray-200 rounded-lg px-3 py-1.5"
            >
              <Search size={15} />
              차량 검색
            </button>
          )}
        </div>

        {searchQuery.trim() && (
          <div className="max-w-2xl mx-auto mt-1.5">
            <p className="text-xs text-blue-600">
              {'"'}{searchQuery}{'"'} — {searchHighlights.size}개 날짜 하이라이트
            </p>
          </div>
        )}
      </div>

      {/* 캘린더 */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-2xl mx-auto px-2 py-2">
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

          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="h-14" />

              const dateKey      = formatDateKey(day)
              const daySchedules = byDate[dateKey] ?? []
              const count        = daySchedules.length
              const isToday      = dateKey === todayKey
              const isSelected   = dateKey === selectedDate
              const isHighlight  = searchQuery.trim() && searchHighlights.has(dateKey)
              const isOvercount  = daySchedules.some(s => s.is_overcount)
              const hasInterior  = daySchedules.some(s => s.has_interior)
              const dow          = new Date(year, month, day).getDay()

              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                  className={`
                    relative h-14 rounded-lg flex flex-col items-center justify-start pt-1.5 transition-colors
                    ${isSelected  ? 'bg-blue-600 text-white'
                    : isHighlight ? 'bg-yellow-50 border-2 border-yellow-400'
                    : isToday     ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50 border border-transparent'}
                  `}
                >
                  <span className={`
                    text-xs font-semibold leading-none
                    ${isSelected ? 'text-white'
                    : isHighlight ? 'text-yellow-700'
                    : isToday    ? 'text-blue-600'
                    : dow === 0  ? 'text-red-400'
                    : dow === 6  ? 'text-blue-400'
                    : 'text-gray-700'}
                  `}>
                    {day}
                  </span>

                  {count > 0 && (
                    <span className={`
                      mt-1 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center
                      ${isSelected  ? 'bg-white text-blue-600'
                      : isHighlight ? 'bg-yellow-400 text-white'
                      : isOvercount ? 'bg-orange-100 text-orange-600'
                      : 'bg-blue-100 text-blue-700'}
                    `}>
                      {count}
                    </span>
                  )}

                  {/* 실내작업 표시 */}
                  {hasInterior && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-400" />
                  )}

                  {isOvercount && !isSelected && (
                    <span className="absolute top-0.5 right-0.5">
                      <AlertTriangle size={9} className="text-orange-400" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {!loading && (
            <div className="mt-3 text-xs text-gray-600 grid grid-cols-3 gap-3">
              <div className="text-left text-gray-700">이번달 총 작업대수 {schedules.length}대</div>
              <div className="text-center">이번달 등록 차량 수 {vehicles.length}대</div>
              <div className="text-right">정기 차량 수 {regularVehicles.length}대</div>
            </div>
          )}
        </div>
      </div>

      {/* 선택된 날짜 상세 */}
      {selectedDate && (
        <div className="border-t border-gray-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">
                {month + 1}월 {parseInt(selectedDate.split('-')[2])}일 —&nbsp;
                <span className="text-blue-600">{selectedSchedules.length}대</span>
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleReorderMode}
                  className={`flex items-center gap-1 text-xs border px-2 py-1 rounded-lg transition-colors ${
                    reorderMode
                      ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <GripVertical size={12} />
                  {reorderMode ? '완료' : '순서 변경'}
                </button>
                <button
                  onClick={() => setShowAddForm(v => !v)}
                  className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors"
                >
                  <Plus size={12} />
                  일세차 추가
                </button>
                <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 일세차 추가 폼 */}
            {showAddForm && (
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                <input
                  autoFocus
                  type="text"
                  value={addVehicleSearch}
                  onChange={e => setAddVehicleSearch(e.target.value)}
                  placeholder="차량명, 번호판, 동호수, 고객명 검색"
                  className="w-full text-sm border border-blue-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white mb-2"
                />
                {filteredAddVehicles.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">검색 결과 없음</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {filteredAddVehicles.map(v => (
                      <button
                        key={v.id}
                        onClick={() => addOnetimeSchedule(v.id)}
                        className="w-full text-left flex items-center gap-2 bg-white hover:bg-blue-100 border border-blue-100 rounded-lg px-3 py-2 text-sm transition-colors"
                      >
                        <span className="font-medium text-gray-900">{v.car_name}</span>
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{v.plate_number}</span>
                        <span className="text-xs text-gray-400">{v.unit_number}</span>
                        {v.customer?.apartment && (
                          <span className="text-xs text-blue-500 flex items-center gap-0.5 ml-auto">
                            <Home size={10} />
                            {v.customer.apartment}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="max-h-72 overflow-y-auto">
              {displayedSchedules.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">예약 없음</p>
              ) : reorderMode ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={manualOrder} strategy={verticalListSortingStrategy}>
                    {displayedSchedules.map(s => (
                      <SortableRow key={s.id} id={s.id}>
                        <ScheduleRow
                          schedule={s}
                          onDelete={() => deleteSchedule(s.id)}
                          onDateChange={(newDate) => changeScheduleDate(s.id, newDate)}
                          onInteriorToggle={() => toggleInterior(s.id, !!s.has_interior)}
                          selectedDate={selectedDate}
                          supabaseClient={supabase}
                        />
                      </SortableRow>
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="divide-y divide-gray-100">
                  {displayedSchedules.map(s => (
                    <ScheduleRow
                      key={s.id}
                      schedule={s}
                      onDelete={() => deleteSchedule(s.id)}
                      onDateChange={(newDate) => changeScheduleDate(s.id, newDate)}
                      onInteriorToggle={() => toggleInterior(s.id, !!s.has_interior)}
                      selectedDate={selectedDate}
                      supabaseClient={supabase}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── 드래그 정렬 래퍼 ─── */
function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined }}
      className={`flex items-stretch border-b border-gray-100 last:border-0 bg-white ${isDragging ? 'shadow-lg opacity-90' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center px-2 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none select-none"
      >
        <GripVertical size={16} />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

/* ─── 일정 행 ─── */
function ScheduleRow({
  schedule, onDelete, onDateChange, onInteriorToggle, selectedDate, supabaseClient,
}: {
  schedule: ScheduleWithVehicle
  onDelete: () => void
  onDateChange: (newDate: string) => void
  onInteriorToggle: () => void
  selectedDate: string
  supabaseClient: ReturnType<typeof createClient>
}) {
  const [done,           setDone]           = useState(false)
  const [editingDate,    setEditingDate]    = useState(false)
  const [newDate,        setNewDate]        = useState(schedule.scheduled_date)

  useEffect(() => {
    async function check() {
      const { data } = await supabaseClient
        .from('wash_records')
        .select('id')
        .eq('vehicle_id', schedule.vehicle_id)
        .eq('wash_date', selectedDate)
        .maybeSingle()
      setDone(!!data)
    }
    check()
  }, [schedule.vehicle_id, selectedDate])

  async function saveDate() {
    if (newDate && newDate !== schedule.scheduled_date) {
      onDateChange(newDate)
    }
    setEditingDate(false)
  }

  const v = schedule.vehicle

  return (
    <div className={`px-4 py-3 ${done ? 'opacity-60' : ''}`}>
      {/* 상단 행: 완료 아이콘 + 차량 정보 + 삭제 버튼 */}
      <div className="flex items-start gap-3">
        {done
          ? <CheckCircle2 size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
          : <Circle       size={20} className="text-gray-300 flex-shrink-0 mt-0.5" />
        }

        <div className="flex-1 min-w-0">
          {/* 차량명 + 번호판 + 배지 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {v?.car_name}
            </span>
            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {v?.plate_number}
            </span>
            {schedule.is_overcount && (
              <span className="flex items-center gap-0.5 text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">
                <AlertTriangle size={10} />
                월3회
              </span>
            )}
            {v?.is_legacy && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                ◆ 기존
              </span>
            )}
            {schedule.has_interior && (
              <span className="flex items-center gap-0.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                <Sofa size={10} />
                실내
              </span>
            )}
          </div>

          {/* 고객명 + 동호수 + 아파트 */}
          <p className="text-xs text-gray-400 mt-0.5">
            {v?.customer?.name}
            {v?.unit_number && ` · ${v.unit_number}`}
            {v?.customer?.apartment && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-blue-500">
                <Home size={10} />
                {v.customer.apartment}
              </span>
            )}
          </p>

          {/* 날짜 변경 */}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {editingDate ? (
              <>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="text-xs border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={saveDate}
                  className="text-xs text-white bg-blue-600 px-2 py-0.5 rounded hover:bg-blue-700"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={() => { setEditingDate(false); setNewDate(schedule.scheduled_date) }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditingDate(true)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Edit2 size={10} />
                날짜 변경
              </button>
            )}

            {/* 실내작업 토글 */}
            <button
              onClick={onInteriorToggle}
              className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded transition-colors ${
                schedule.has_interior
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              <Sofa size={10} />
              {schedule.has_interior ? '실내 ✓' : '실내 추가'}
            </button>
          </div>

        </div>

        {/* 삭제 버튼 (모든 일정) */}
        <button
          onClick={() => {
            if (confirm('이 일정을 삭제하시겠습니까?')) onDelete()
          }}
          className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
