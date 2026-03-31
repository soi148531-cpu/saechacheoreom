'use client'

// Design Ref: §5.6 — 직원 작업 체크 페이지 (로그인 없이 URL 공유)
// Plan SC: SC-04

import { useEffect, useState, useRef } from 'react'
import { Camera, CheckCircle2, Circle, Upload, ChevronDown, ChevronUp, Home, MessageSquare } from 'lucide-react'
import { createClient, db } from '@/lib/supabase/client'
import { CAR_GRADE_LABELS } from '@/lib/constants/pricing'
import type { Vehicle, Schedule } from '@/types'

type ScheduleRow = Schedule & {
  vehicle: Vehicle & { customer: { name: string; apartment: string } }
}

interface TaskItem {
  schedule: ScheduleRow
  done: boolean
  memo: string
  photos: string[]        // public URLs
  uploading: boolean
  expanded: boolean
  washRecordId: string | null
}

export default function StaffPage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [tasks,   setTasks]   = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [date,    setDate]    = useState(today)

  useEffect(() => { fetchTasks() }, [date])

  async function fetchTasks() {
    setLoading(true)

    const { data: schedules } = await supabase
      .from('schedules')
      .select('*, vehicle:vehicles(*, customer:customers(name, apartment))')
      .eq('scheduled_date', date)
      .eq('is_deleted', false)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at')

    if (!schedules) { setLoading(false); return }

    const rows = schedules as ScheduleRow[]

    // 오늘 날짜 wash_record 이미 있는 것 확인
    const vehicleIds = rows.map(s => s.vehicle_id)
    const { data: records } = vehicleIds.length > 0
      ? await supabase
          .from('wash_records')
          .select('id, vehicle_id')
          .in('vehicle_id', vehicleIds)
          .eq('wash_date', date)
      : { data: [] as Array<{ id: string; vehicle_id: string }> }

    // 각 schedule의 사진 조회
    const { data: photos } = await supabase
      .from('wash_photos')
      .select('vehicle_id, photo_url')
      .in('vehicle_id', vehicleIds)
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`)

    const photoRows = (photos ?? []) as Array<{ vehicle_id: string; photo_url: string }>
    const recordRows = (records ?? []) as Array<{ id: string; vehicle_id: string }>

    const items: TaskItem[] = rows.map(s => {
      const record = recordRows.find(r => r.vehicle_id === s.vehicle_id)
      const vehiclePhotos = photoRows
        .filter(p => p.vehicle_id === s.vehicle_id)
        .map(p => p.photo_url)
      return {
        schedule: s as any,
        done: !!record,
        memo: '',
        photos: vehiclePhotos,
        uploading: false,
        expanded: !record,       // 미완료는 기본 펼침
        washRecordId: record?.id ?? null,
      }
    })

    setTasks(items)
    setLoading(false)
  }

  function updateTask(idx: number, patch: Partial<TaskItem>) {
    setTasks(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t))
  }

  async function toggleDone(idx: number) {
    const task = tasks[idx]
    const v = task.schedule.vehicle

    if (task.done) {
      // 완료 취소 — wash_record 삭제
      if (task.washRecordId) {
        await db().from('wash_records').delete().eq('id', task.washRecordId)
      }
      updateTask(idx, { done: false, washRecordId: null })
    } else {
      // 완료 처리 — wash_record 생성
      const { data: rec } = await db()
        .from('wash_records')
        .insert({
          vehicle_id: v.id,
          wash_date:  date,
          price:      v.unit_price ?? 0,
          memo:       task.memo.trim() || null,
        })
        .select()
        .single()

      if (rec) {
        updateTask(idx, { done: true, washRecordId: rec.id, expanded: false })
      }
    }
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

    // wash_photos 테이블에 저장
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
            <h1 className="text-lg font-bold text-gray-900">직원 작업</h1>
            <p className="text-xs text-gray-400">새차처럼 세차 서비스</p>
          </div>
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
        {/* 진행 바 */}
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
            {tasks.map((task, idx) => (
              <TaskCard
                key={task.schedule.id}
                task={task}
                onToggle={() => toggleDone(idx)}
                onMemoChange={v => updateTask(idx, { memo: v })}
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
  task, onToggle, onMemoChange, onExpand, onPhotoUpload,
}: {
  task: TaskItem
  onToggle: () => void
  onMemoChange: (v: string) => void
  onExpand: () => void
  onPhotoUpload: (f: File) => void
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
        {/* 완료 체크 */}
        <button
          onClick={onToggle}
          className={`flex-shrink-0 transition-colors ${
            task.done ? 'text-green-500' : 'text-gray-300 hover:text-blue-400'
          }`}
        >
          {task.done
            ? <CheckCircle2 size={28} />
            : <Circle size={28} />
          }
        </button>

        {/* 차량 정보 */}
        <div className="flex-1 min-w-0" onClick={onExpand} role="button">
          <div className="flex items-center gap-2">
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
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {customer?.name} · {v.unit_number} · {CAR_GRADE_LABELS[v.car_grade]}
            {customer?.apartment && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-blue-500 font-medium">
                <Home size={10} />
                {customer.apartment}
              </span>
            )}
          </p>
        </div>

        {/* 펼침 토글 */}
        <button onClick={onExpand} className="text-gray-400 flex-shrink-0">
          {task.expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* 상세 (펼침) */}
      {task.expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {/* 관리자 메모 (읽기 전용) */}
          {task.schedule.admin_memo && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <MessageSquare size={11} />
                관리자 지시사항
              </p>
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{task.schedule.admin_memo}</p>
            </div>
          )}

          {/* 작업자 메모 */}
          <textarea
            value={task.memo}
            onChange={e => onMemoChange(e.target.value)}
            placeholder="작업자 메모 (특이사항, 요청사항 등)"
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

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

            {/* 사진 목록 */}
            {task.photos.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {task.photos.map((url, i) => (
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
            <button
              onClick={onToggle}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              세차 완료 처리
            </button>
          )}

          {task.done && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-600 font-medium">✓ 완료 처리됨</span>
              <button
                onClick={onToggle}
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
