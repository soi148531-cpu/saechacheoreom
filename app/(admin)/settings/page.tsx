'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, AlertCircle, ChevronUp, ChevronDown, Plus, X, Edit2, Check, Trash2, Repeat2 } from 'lucide-react'
import { usePricing, PriceTable } from '@/lib/hooks/usePricing'
import { MessageSettingsPanel } from '@/components/MessageSettingsPanel'
import { CAR_GRADE_LABELS } from '@/lib/constants/pricing'
import type { CarGrade } from '@/types'

type SettingTab = 'price' | 'worker' | 'message' | 'staff' | 'expense'

interface WorkerItem {
  id: string
  name: string
  phone: string | null
  status: string
  outdoor_rate?: number
  indoor_rate?: number
}

const MONTHLY_TABS: { key: string; label: string }[] = [
  { key: 'monthly_1', label: '월1회' },
  { key: 'monthly_2', label: '월2회' },
  { key: 'monthly_4', label: '월4회' },
  { key: 'onetime',   label: '비정기' },
]

const CAR_GRADES = Object.keys(CAR_GRADE_LABELS) as CarGrade[]

interface WorkerRates {
  outdoor_rate: number
  indoor_rate: number
  updated_at: string
  updated_by: string
}

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingTab>('price')

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-4">설정</h1>

      {/* 탭 */}
      <div className="grid grid-cols-5 gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        {([
          { key: 'price',   label: '가격표' },
          { key: 'worker',  label: '작업자단가' },
          { key: 'staff',   label: '직원관리' },
          { key: 'message', label: '카톡메시지' },
          { key: 'expense', label: '지출관리' },
        ] as { key: SettingTab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`py-2 rounded-md text-[11px] font-medium transition-colors ${
              tab === key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'price'   ? <PriceTableSettings /> :
       tab === 'worker'  ? <WorkerRateSettings /> :
       tab === 'staff'   ? <WorkerManagement /> :
       tab === 'expense' ? <ExpenseSettings /> :
       <MessageSettingsPanel />}
    </div>
  )
}

// ─── 가격표 설정 ──────────────────────────────────────────────────────────────

function PriceTableSettings() {
  const { priceTable, loading, saving, savePriceTable } = usePricing()
  const [editTable, setEditTable] = useState<PriceTable | null>(null)
  const [activeCount, setActiveCount] = useState<string>('monthly_1')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (priceTable && !editTable) setEditTable(JSON.parse(JSON.stringify(priceTable)))
  }, [priceTable, editTable])

  if (loading || !editTable) {
    return <div className="text-center py-10 text-gray-400 text-sm">가격표 로딩 중...</div>
  }

  function setMonthlyPrice(count: string, grade: CarGrade, val: number) {
    setEditTable(prev => {
      if (!prev) return prev
      return {
        ...prev,
        monthly: {
          ...prev.monthly,
          [count]: { ...prev.monthly[count], [grade]: val },
        },
      }
    })
  }

  function setOnetimePrice(grade: CarGrade, val: number) {
    setEditTable(prev => prev ? { ...prev, onetime: { ...prev.onetime, [grade]: val } } : prev)
  }

  function setInteriorPrice(val: number) {
    setEditTable(prev => prev ? { ...prev, interior: val } : prev)
  }

  async function handleSave() {
    if (!editTable) return
    const ok = await savePriceTable(editTable)
    setMessage(ok
      ? { type: 'success', text: '✅ 가격표가 저장되었습니다.' }
      : { type: 'error', text: '❌ 저장 실패. 다시 시도해주세요.' }
    )
    setTimeout(() => setMessage(null), 3000)
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <AlertCircle size={16} />
          {message.text}
        </div>
      )}

      {/* 회수 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {MONTHLY_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveCount(t.key)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeCount === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 차종별 가격 입력 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-3">
          {activeCount === 'onetime' ? '비정기(일세차) 가격' : `${MONTHLY_TABS.find(t => t.key === activeCount)?.label} 월정가`}
        </p>
        <div className="space-y-2">
          {CAR_GRADES.map(grade => {
            const val = activeCount === 'onetime'
              ? editTable.onetime[grade]
              : editTable.monthly[activeCount]?.[grade] ?? 0
            return (
              <div key={grade} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700 w-24 shrink-0">{CAR_GRADE_LABELS[grade]}</span>
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="number"
                    value={val}
                    onChange={e => {
                      const n = parseInt(e.target.value) || 0
                      if (activeCount === 'onetime') {
                        setOnetimePrice(grade, n)
                      } else {
                        setMonthlyPrice(activeCount, grade, n)
                      }
                    }}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step={1000}
                    min={0}
                  />
                  <span className="text-xs text-gray-400 shrink-0">원</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 실내 청소 단가 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-3">실내 청소 추가 단가 (전 차종 동일)</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={editTable.interior}
            onChange={e => setInteriorPrice(parseInt(e.target.value) || 0)}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
            step={1000}
            min={0}
          />
          <span className="text-xs text-gray-400">원</span>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
      >
        <Save size={18} />
        {saving ? '저장 중...' : '가격표 저장'}
      </button>
    </div>
  )
}

// ─── 작업자 단가 설정 (기존) ─────────────────────────────────────────────────

function WorkerRateSettings() {
  const [rates, setRates] = useState<WorkerRates>({
    outdoor_rate: 10000,
    indoor_rate: 10000,
    updated_at: new Date().toISOString(),
    updated_by: 'admin',
  })
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [message,  setMessage]  = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [demo,     setDemo]     = useState({ outdoor: 5, indoor: 2 })

  useEffect(() => {
    fetch('/api/worker-rates')
      .then(r => r.json())
      .then(result => { if (result.success && result.data) setRates(result.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/worker-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outdoor_rate: rates.outdoor_rate, indoor_rate: rates.indoor_rate, notes: '기본료 설정 변경' }),
      })
      const result = await res.json()
      if (result.success) {
        setMessage({ type: 'success', text: '✅ 단가가 저장되었습니다.' })
        setRates(result.data)
      } else {
        setMessage({ type: 'error', text: `❌ 저장 실패: ${result.error}` })
      }
    } catch {
      setMessage({ type: 'error', text: '❌ 저장 중 오류가 발생했습니다.' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (loading) return <div className="text-center py-10 text-gray-400 text-sm">로딩 중...</div>

  return (
    <div className="space-y-4">
      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <AlertCircle size={16} />
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <p className="text-sm font-semibold text-gray-700">기본 작업료</p>
        {[
          { key: 'outdoor_rate' as const, label: '실외세차 (₩/건)', color: 'blue' },
          { key: 'indoor_rate'  as const, label: '실내청소 (₩/건)', color: 'green' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs text-gray-500 mb-1 block">{label}</label>
            <input
              type="number"
              value={rates[key]}
              onChange={e => setRates({ ...rates, [key]: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              step={1000}
              min={0}
            />
          </div>
        ))}
      </div>

      {/* 계산 예시 */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-3">급여 계산 예시</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { key: 'outdoor' as const, label: '실외세차 건수' },
            { key: 'indoor'  as const, label: '실내청소 건수' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 block mb-1">{label}</label>
              <input
                type="number"
                value={demo[key]}
                onChange={e => setDemo({ ...demo, [key]: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                min={0}
              />
            </div>
          ))}
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between bg-blue-50 px-3 py-1.5 rounded">
            <span className="text-gray-600">실외세차</span>
            <span className="font-semibold">{(demo.outdoor * rates.outdoor_rate).toLocaleString()}원</span>
          </div>
          <div className="flex justify-between bg-green-50 px-3 py-1.5 rounded">
            <span className="text-gray-600">실내청소</span>
            <span className="font-semibold">{(demo.indoor * rates.indoor_rate).toLocaleString()}원</span>
          </div>
          <div className="flex justify-between bg-purple-50 px-3 py-2 rounded font-bold">
            <span>총 급여</span>
            <span>{(demo.outdoor * rates.outdoor_rate + demo.indoor * rates.indoor_rate).toLocaleString()}원</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
      >
        <Save size={18} />
        {saving ? '저장 중...' : '단가 저장'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        마지막 저장: {new Date(rates.updated_at).toLocaleString('ko-KR')}
      </p>
    </div>
  )
}

// ─── 직원 관리 ────────────────────────────────────────────────────────────────

function WorkerManagement() {
  const [workers, setWorkers] = useState<WorkerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editOutdoorRate, setEditOutdoorRate] = useState<number>(10000)
  const [editIndoorRate, setEditIndoorRate] = useState<number>(10000)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newOutdoorRate, setNewOutdoorRate] = useState<number>(10000)
  const [newIndoorRate, setNewIndoorRate] = useState<number>(10000)
  const [showAddForm, setShowAddForm] = useState(false)

  const applySavedOrder = (list: WorkerItem[]) => {
    try {
      const saved = localStorage.getItem('worker_sort_order')
      if (!saved) return list
      const order: string[] = JSON.parse(saved)
      return [...list].sort((a, b) => {
        const ai = order.indexOf(a.id)
        const bi = order.indexOf(b.id)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    } catch {
      return list
    }
  }

  const saveOrder = (list: WorkerItem[]) => {
    localStorage.setItem('worker_sort_order', JSON.stringify(list.map(w => w.id)))
  }

  const loadWorkers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workers?includeInactive=true')
      const json = await res.json()
      const raw: WorkerItem[] = Array.isArray(json) ? json : json.data || []
      setWorkers(applySavedOrder(raw))
      setError('')
    } catch {
      setError('직원 목록 불러오기 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadWorkers() }, [])

  const moveWorker = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= workers.length) return
    const next = [...workers]
    ;[next[index], next[target]] = [next[target], next[index]]
    setWorkers(next)
    saveOrder(next)
  }

  const handleAdd = async () => {
    if (!newName.trim()) { setError('이름을 입력하세요'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim() || null, status: 'active', outdoor_rate: newOutdoorRate, indoor_rate: newIndoorRate }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || '추가 실패') }
      setNewName(''); setNewPhone(''); setNewOutdoorRate(10000); setNewIndoorRate(10000); setShowAddForm(false)
      await loadWorkers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가 중 오류')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) { setError('이름을 입력하세요'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/workers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), phone: editPhone.trim() || null, outdoor_rate: editOutdoorRate, indoor_rate: editIndoorRate }),
      })
      if (!res.ok) throw new Error('수정 실패')
      setEditingId(null)
      await loadWorkers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정 중 오류')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/workers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('삭제 실패')
      await loadWorkers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 중 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={16} />{error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">순서를 바꾸면 당번 선택 목록에도 반영됩니다</p>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus size={16} /> 직원 추가
        </button>
      </div>

      {showAddForm && (
        <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-gray-800">새 직원 등록</p>
          <input
            type="text"
            placeholder="이름"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            type="tel"
            placeholder="연락처 (선택)"
            value={newPhone}
            onChange={e => setNewPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">실외세차 단가 (원/건)</label>
              <input
                type="number"
                value={newOutdoorRate}
                onChange={e => setNewOutdoorRate(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                step={1000}
                min={0}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">실내청소 단가 (원/건)</label>
              <input
                type="number"
                value={newIndoorRate}
                onChange={e => setNewIndoorRate(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                step={1000}
                min={0}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              등록
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-300">
              취소
            </button>
          </div>
        </div>
      )}

      {loading && workers.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">로딩 중...</div>
      ) : (
        <div className="space-y-2">
          {workers.map((worker, index) => (
            <div key={worker.id} className="bg-white border border-gray-200 rounded-xl p-3">
              {editingId === worker.id ? (
                <div className="space-y-2">
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    placeholder="이름"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                    placeholder="연락처"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">실외세차 단가 (원/건)</label>
                      <input
                        type="number"
                        value={editOutdoorRate}
                        onChange={e => setEditOutdoorRate(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        step={1000}
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">실내청소 단가 (원/건)</label>
                      <input
                        type="number"
                        value={editIndoorRate}
                        onChange={e => setEditIndoorRate(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        step={1000}
                        min={0}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(worker.id)} disabled={loading}
                      className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white py-2 rounded-lg text-sm">
                      <Check size={15} /> 저장
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="flex-1 flex items-center justify-center gap-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm">
                      <X size={15} /> 취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {/* 순서 조절 */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveWorker(index, -1)} disabled={index === 0}
                      className="p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-20">
                      <ChevronUp size={18} />
                    </button>
                    <button onClick={() => moveWorker(index, 1)} disabled={index === workers.length - 1}
                      className="p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-20">
                      <ChevronDown size={18} />
                    </button>
                  </div>

                  {/* 순서 번호 */}
                  <span className="text-xs font-bold text-gray-400 w-4 text-center">{index + 1}</span>

                  {/* 이름/연락처 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{worker.name}</p>
                    {worker.phone && <p className="text-xs text-gray-500">{worker.phone}</p>}
                    <p className="text-xs mt-0.5">
                      <span className={worker.status === 'active' ? 'text-green-600' : 'text-gray-400'}>
                        {worker.status === 'active' ? '활성' : '비활성'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      실외 {(worker.outdoor_rate ?? 10000).toLocaleString()}원 · 실내 {(worker.indoor_rate ?? 10000).toLocaleString()}원
                    </p>
                  </div>

                  {/* 수정/삭제 */}
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditingId(worker.id); setEditName(worker.name); setEditPhone(worker.phone || ''); setEditOutdoorRate(worker.outdoor_rate ?? 10000); setEditIndoorRate(worker.indoor_rate ?? 10000) }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(worker.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 지출 설정 (카테고리 + 고정지출) ────────────────────────────────────────────

function ExpenseSettings() {
  const [subTab, setSubTab] = useState<'category' | 'recurring'>('category')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {(['category', 'recurring'] as const).map(key => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              subTab === key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            {key === 'category' ? '카테고리' : '고정지출'}
          </button>
        ))}
      </div>
      {subTab === 'category' ? <CategorySettings /> : <RecurringSettings />}
    </div>
  )
}

// ─── 카테고리 관리 ────────────────────────────────────────────────────────────

function CategorySettings() {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/expense-categories')
    const result = await res.json()
    if (result.success) setCategories(result.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!newName.trim()) { setError('이름을 입력하세요'); return }
    const res = await fetch('/api/expense-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    if (res.ok) { setNewName(''); setShowAdd(false); load() }
    else setError('추가에 실패했습니다')
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) { setError('이름을 입력하세요'); return }
    const res = await fetch(`/api/expense-categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    })
    if (res.ok) { setEditingId(null); load() }
    else setError('수정에 실패했습니다')
  }

  async function handleDelete(id: string) {
    if (!confirm('카테고리를 삭제하시겠습니까?\n해당 카테고리의 지출 항목은 미분류로 변경됩니다.')) return
    const res = await fetch(`/api/expense-categories/${id}`, { method: 'DELETE' })
    if (res.ok) load()
    else setError('삭제에 실패했습니다')
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={16} />{error}
          <button onClick={() => setError('')} className="ml-auto p-0.5"><X size={14} /></button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">지출 항목을 분류하는 카테고리입니다</p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus size={16} /> 추가
        </button>
      </div>

      {showAdd && (
        <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
          <input
            type="text"
            placeholder="카테고리 이름 (예: 소모품)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              등록
            </button>
            <button onClick={() => { setShowAdd(false); setNewName('') }}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-300">
              취소
            </button>
          </div>
        </div>
      )}

      {loading && categories.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">로딩 중...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-8 text-gray-300 text-sm">카테고리가 없습니다</div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="bg-white border border-gray-200 rounded-xl p-3">
              {editingId === cat.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUpdate(cat.id)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    autoFocus
                  />
                  <button onClick={() => handleUpdate(cat.id)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg">
                    <Check size={18} />
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium text-gray-900">{cat.name}</span>
                  <button
                    onClick={() => { setEditingId(cat.id); setEditName(cat.name) }}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(cat.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 고정지출 관리 ────────────────────────────────────────────────────────────

interface RecurringItem {
  id: string
  name: string
  category_id: string | null
  amount: number
  day_of_month: number
  is_active: boolean
  category?: { id: string; name: string }
}

type RecurringForm = { name: string; category_id: string; amount: string; day_of_month: string }
const EMPTY_RECURRING_FORM: RecurringForm = { name: '', category_id: '', amount: '', day_of_month: '1' }

function RecurringSettings() {
  const [items, setItems] = useState<RecurringItem[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RecurringForm>(EMPTY_RECURRING_FORM)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [rRes, cRes] = await Promise.all([
      fetch('/api/expense-recurring'),
      fetch('/api/expense-categories'),
    ])
    const [r, c] = await Promise.all([rRes.json(), cRes.json()])
    if (r.success) setItems(r.data)
    if (c.success) setCategories(c.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function validate() {
    if (!form.name.trim()) { setError('이름을 입력하세요'); return false }
    if (!form.amount || parseInt(form.amount) <= 0) { setError('금액을 입력하세요'); return false }
    const day = parseInt(form.day_of_month)
    if (!day || day < 1 || day > 31) { setError('날짜(1~31)를 입력하세요'); return false }
    return true
  }

  async function handleAdd() {
    if (!validate()) return
    const res = await fetch('/api/expense-recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        category_id: form.category_id || null,
        amount: parseInt(form.amount),
        day_of_month: parseInt(form.day_of_month),
      }),
    })
    if (res.ok) { setForm(EMPTY_RECURRING_FORM); setShowAdd(false); load() }
    else setError('추가에 실패했습니다')
  }

  async function handleUpdate(id: string) {
    if (!validate()) return
    const res = await fetch(`/api/expense-recurring/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        category_id: form.category_id || null,
        amount: parseInt(form.amount),
        day_of_month: parseInt(form.day_of_month),
      }),
    })
    if (res.ok) { setEditingId(null); setForm(EMPTY_RECURRING_FORM); load() }
    else setError('수정에 실패했습니다')
  }

  async function handleDelete(id: string) {
    if (!confirm('고정지출을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/expense-recurring/${id}`, { method: 'DELETE' })
    if (res.ok) load()
    else setError('삭제에 실패했습니다')
  }

  async function toggleActive(item: RecurringItem) {
    await fetch(`/api/expense-recurring/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    })
    load()
  }

  const FormPanel = ({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) => (
    <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
      <input
        type="text"
        placeholder="이름 (예: 창고임대료)"
        value={form.name}
        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />
      <select
        value={form.category_id}
        onChange={e => setForm(prev => ({ ...prev, category_id: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      >
        <option value="">카테고리 없음</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-gray-500 mb-1 block">금액 (원)</label>
          <input
            type="number"
            placeholder="300000"
            value={form.amount}
            onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            step={1000}
            min={0}
          />
        </div>
        <div className="w-28">
          <label className="text-[10px] text-gray-500 mb-1 block">매월 몇 일</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              placeholder="1"
              value={form.day_of_month}
              onChange={e => setForm(prev => ({ ...prev, day_of_month: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min={1}
              max={31}
            />
            <span className="text-xs text-gray-500 shrink-0">일</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={loading}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          저장
        </button>
        <button onClick={onCancel}
          className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-300">
          취소
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={16} />{error}
          <button onClick={() => setError('')} className="ml-auto p-0.5"><X size={14} /></button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">설정한 날짜에 자동으로 지출 처리됩니다</p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus size={16} /> 추가
        </button>
      </div>

      {showAdd && (
        <FormPanel
          onSave={handleAdd}
          onCancel={() => { setShowAdd(false); setForm(EMPTY_RECURRING_FORM) }}
        />
      )}

      {loading && items.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">로딩 중...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-300 text-sm">고정지출이 없습니다</div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className={`bg-white border rounded-xl p-3 transition-opacity ${
                item.is_active ? 'border-gray-200' : 'border-gray-100 opacity-50'
              }`}
            >
              {editingId === item.id ? (
                <FormPanel
                  onSave={() => handleUpdate(item.id)}
                  onCancel={() => { setEditingId(null); setForm(EMPTY_RECURRING_FORM) }}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Repeat2 size={14} className="text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm text-gray-900">{item.name}</span>
                      {item.category && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {item.category.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      매월 {item.day_of_month}일 · {item.amount.toLocaleString()}원
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(item)}
                      className={`text-[10px] px-2 py-1 rounded font-semibold ${
                        item.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {item.is_active ? '활성' : '정지'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(item.id)
                        setForm({
                          name: item.name,
                          category_id: item.category_id ?? '',
                          amount: String(item.amount),
                          day_of_month: String(item.day_of_month),
                        })
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
