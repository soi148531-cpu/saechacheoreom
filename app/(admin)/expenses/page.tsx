'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Repeat2, X, Trash2 } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import type { Expense, ExpenseCategory } from '@/types'

type FormState = {
  date: string
  category_id: string
  amount: string
  memo: string
}

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ExpensesPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showSheet, setShowSheet] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ date: getTodayStr(), category_id: '', amount: '', memo: '' })
  const [saving, setSaving] = useState(false)

  const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/expenses?year_month=${yearMonth}`)
      const result = await res.json()
      if (result.success) setExpenses(result.data)
    } finally {
      setLoading(false)
    }
  }, [yearMonth])

  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/expense-categories')
    const result = await res.json()
    if (result.success) setCategories(result.data)
  }, [])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])
  useEffect(() => { fetchCategories() }, [fetchCategories])

  function changeMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  const monthlyTotal = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses])

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach(e => {
      const key = e.category?.name ?? '미분류'
      map[key] = (map[key] ?? 0) + e.amount
    })
    return map
  }, [expenses])

  function openAdd() {
    setEditingId(null)
    setForm({ date: getTodayStr(), category_id: '', amount: '', memo: '' })
    setShowSheet(true)
  }

  function openEdit(expense: Expense) {
    setEditingId(expense.id)
    setForm({
      date: expense.date,
      category_id: expense.category_id ?? '',
      amount: String(expense.amount),
      memo: expense.memo ?? '',
    })
    setShowSheet(true)
  }

  async function handleSave() {
    if (!form.date) { alert('날짜를 입력하세요'); return }
    const amount = parseInt(form.amount)
    if (!amount || amount <= 0) { alert('금액을 입력하세요'); return }

    setSaving(true)
    try {
      const body = {
        date: form.date,
        category_id: form.category_id || null,
        amount,
        memo: form.memo || null,
      }
      const res = editingId
        ? await fetch(`/api/expenses/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (res.ok) {
        setShowSheet(false)
        fetchExpenses()
      } else {
        alert('저장에 실패했습니다')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 지출 내역을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setShowSheet(false)
      fetchExpenses()
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
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

          <div className="flex items-center gap-2">
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <span className="text-xs text-red-600 font-medium">이달 지출</span>
              <span className="text-sm font-bold text-red-900">
                {loading ? '...' : formatPrice(monthlyTotal)}
              </span>
            </div>
            <button
              onClick={openAdd}
              className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} />
              추가
            </button>
          </div>
        </div>
      </div>

      {/* 카테고리 요약 */}
      {categories.length > 0 && (
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
          <div className="max-w-2xl mx-auto flex gap-2 overflow-x-auto pb-0.5">
            {categories.map(cat => {
              const amount = byCategory[cat.name] ?? 0
              return (
                <div
                  key={cat.id}
                  className="flex-shrink-0 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-center min-w-[72px]"
                >
                  <p className="text-[10px] text-gray-500 font-medium truncate max-w-[80px]">{cat.name}</p>
                  <p className={`text-xs font-bold mt-0.5 ${amount > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                    {amount > 0 ? formatPrice(amount) : '-'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 지출 목록 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-10">로딩 중...</p>
          ) : expenses.length === 0 ? (
            <div className="text-center py-14">
              <p className="text-gray-400 text-sm">이번달 지출 내역이 없습니다</p>
              <p className="text-gray-300 text-xs mt-1">+ 추가 버튼으로 기록하세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map(expense => (
                <button
                  key={expense.id}
                  onClick={() => openEdit(expense)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 text-left transition-colors"
                >
                  {/* 날짜 */}
                  <div className="text-center min-w-[28px] shrink-0">
                    <p className="text-[9px] text-gray-400 leading-none">{month + 1}월</p>
                    <p className="text-xl font-bold text-gray-800 leading-tight">
                      {parseInt(expense.date.split('-')[2])}
                    </p>
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {expense.is_recurring && (
                        <Repeat2 size={13} className="text-blue-400 shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {expense.recurring?.name ?? expense.memo ?? ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {expense.category && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {expense.category.name}
                        </span>
                      )}
                      {expense.memo && expense.recurring?.name && (
                        <span className="text-xs text-gray-400 truncate">{expense.memo}</span>
                      )}
                    </div>
                  </div>

                  {/* 금액 */}
                  <span className="font-bold text-gray-900 text-sm shrink-0">
                    {formatPrice(expense.amount)}
                  </span>
                </button>
              ))}

              {/* 합계 행 */}
              <div className="mt-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between">
                <span className="text-sm font-bold text-red-800">이달 합계</span>
                <span className="text-lg font-bold text-red-900">{formatPrice(monthlyTotal)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 추가/수정 모달 — 모바일: 바텀시트 / PC: 가운데 모달 */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center md:p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowSheet(false)}
          />
          <div className="relative bg-white rounded-t-2xl md:rounded-2xl shadow-2xl p-5 pb-8 md:pb-5 w-full md:w-[460px] max-h-[90vh] overflow-y-auto">

            {/* 헤더 */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900 text-base">
                {editingId ? '지출 수정' : '지출 추가'}
              </h3>
              <button onClick={() => setShowSheet(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* 날짜 */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block font-medium">날짜</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 카테고리 — 버튼 칩 */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block font-medium">카테고리</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setForm(prev => ({ ...prev, category_id: '' }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      !form.category_id
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'border-gray-300 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    없음
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setForm(prev => ({ ...prev, category_id: cat.id }))}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        form.category_id === cat.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 금액 */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block font-medium">금액</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.amount}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9]/g, '')
                      setForm(prev => ({ ...prev, amount: v }))
                    }}
                    placeholder="0"
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                  />
                  <span className="text-sm text-gray-500 shrink-0">원</span>
                </div>
                {/* 빠른 금액 */}
                <div className="flex gap-1.5 mt-2">
                  {[10000, 30000, 50000, 100000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => {
                        const current = parseInt(form.amount) || 0
                        setForm(prev => ({ ...prev, amount: String(current + amt) }))
                      }}
                      className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                      +{amt / 10000}만
                    </button>
                  ))}
                  <button
                    onClick={() => setForm(prev => ({ ...prev, amount: '' }))}
                    className="px-2.5 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    초기화
                  </button>
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block font-medium">메모 (선택)</label>
                <input
                  type="text"
                  value={form.memo}
                  onChange={e => setForm(prev => ({ ...prev, memo: e.target.value }))}
                  placeholder="예: 세차 샴푸, 타올 보충"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 버튼 */}
            <div className="mt-5 space-y-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {saving ? '저장 중...' : editingId ? '수정하기' : '추가하기'}
              </button>
              {editingId && (
                <button
                  onClick={() => handleDelete(editingId)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                >
                  <Trash2 size={16} />
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
