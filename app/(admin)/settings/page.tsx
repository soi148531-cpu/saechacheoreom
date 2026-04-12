'use client'

import { useState, useEffect } from 'react'
import { Save, AlertCircle } from 'lucide-react'
import { usePricing, PriceTable } from '@/lib/hooks/usePricing'
import { MessageSettingsPanel } from '@/components/MessageSettingsPanel'
import { CAR_GRADE_LABELS } from '@/lib/constants/pricing'
import type { CarGrade } from '@/types'

type SettingTab = 'price' | 'worker' | 'message'

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
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        <button
          onClick={() => setTab('price')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'price' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
          }`}
        >
          세차 가격표
        </button>
        <button
          onClick={() => setTab('worker')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'worker' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
          }`}
        >
          작업자 단가
        </button>
        <button
          onClick={() => setTab('message')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'message' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
          }`}
        >
          카톡 메시지
        </button>
      </div>

      {tab === 'price' ? <PriceTableSettings /> : tab === 'worker' ? <WorkerRateSettings /> : <MessageSettingsPanel />}
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
