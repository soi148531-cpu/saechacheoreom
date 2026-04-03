'use client'

import { useState, useEffect } from 'react'
import { Trash2, Edit2, Plus, X, Check } from 'lucide-react'

interface Worker {
  id: string
  name: string
  phone: string | null
  status: string
  created_at: string
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  // 직원 목록 조회 (모든 직원 포함)
  const fetchWorkers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/workers?includeInactive=true')
      if (!res.ok) throw new Error('직원 목록 조회 실패')
      const json = await res.json()
      setWorkers(Array.isArray(json) ? json : json.data || [])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkers()
  }, [])

  // 편집 시작
  const startEdit = (worker: Worker) => {
    setEditingId(worker.id)
    setEditName(worker.name)
    setEditPhone(worker.phone || '')
  }

  // 편집 취소
  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditPhone('')
  }

  // 직원 수정
  const handleUpdate = async (id: string) => {
    if (!editName.trim()) {
      setError('이름을 입력하세요')
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`/api/workers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim() || null,
        }),
      })

      if (!res.ok) throw new Error('수정 실패')

      setEditingId(null)
      setEditName('')
      setEditPhone('')
      await fetchWorkers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정 중 오류 발생')
    } finally {
      setLoading(false)
    }
  }

  // 직원 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      setLoading(true)
      const res = await fetch(`/api/workers/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('삭제 실패')

      await fetchWorkers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 중 오류 발생')
    } finally {
      setLoading(false)
    }
  }

  // 직원 추가
  const handleAdd = async () => {
    if (!newName.trim()) {
      setError('이름을 입력하세요')
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim() || null,
          status: 'active',
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || '추가 실패')
      }

      setNewName('')
      setNewPhone('')
      setShowAddForm(false)
      await fetchWorkers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가 중 오류 발생')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">직원 관리</h1>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            신규 등록
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* 신규 등록 폼 */}
        {showAddForm && (
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
            <h3 className="font-bold text-gray-900 mb-3">새 직원 등록</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="이름"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="tel"
                placeholder="연락처 (선택)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  등록
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 직원 목록 */}
        {loading && workers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">로딩 중...</div>
        ) : workers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">등록된 직원이 없습니다</div>
        ) : (
          <div className="space-y-3">
            {workers.map((worker) => (
              <div
                key={worker.id}
                className="bg-white border border-gray-200 rounded-lg p-4"
              >
                {editingId === worker.id ? (
                  // 편집 모드
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(worker.id)}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <Check size={18} />
                        저장
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 flex items-center justify-center gap-2 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                      >
                        <X size={18} />
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  // 표시 모드
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{worker.name}</p>
                      {worker.phone && (
                        <p className="text-sm text-gray-600">{worker.phone}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        상태: <span className={worker.status === 'active' ? 'text-green-600' : 'text-gray-600'}>
                          {worker.status === 'active' ? '활성' : '비활성'}
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(worker)}
                        disabled={loading}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                        title="수정"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(worker.id)}
                        disabled={loading}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        title="삭제"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
