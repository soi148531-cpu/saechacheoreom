'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle, Clock, AlertCircle, Plus, Trash2, X, Copy, Edit2, Save, Search } from 'lucide-react'
import { createClient, db } from '@/lib/supabase/client'
import { CAR_GRADE_LABELS, MONTHLY_COUNT_LABELS, INTERIOR_PRICE } from '@/lib/constants/pricing'
import { formatPrice, formatYearMonth, getCurrentYearMonth } from '@/lib/utils'
import type { Vehicle, WashRecord, Billing, BillingItem, PaymentStatus, Customer } from '@/types'

interface VehicleBilling {
  vehicle: Vehicle
  records: WashRecord[]
  extraItems: BillingItem[]
  washTotal: number
  extraTotal: number
  totalAmount: number
  paymentStatus: PaymentStatus
  paidAmount: number
  billingId: string | null
}

interface CustomerBilling {
  customerId: string
  customer: Customer
  vehicles: VehicleBilling[]
  totalAmount: number
  totalRecords: number
  paymentStatus: PaymentStatus
  memo: string | null
}

interface NewItem { name: string; price: string; qty: string }

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  paid:    { label: '입금완료', color: 'text-green-600 bg-green-50',   icon: CheckCircle },
  partial: { label: '부분납',   color: 'text-yellow-600 bg-yellow-50', icon: AlertCircle },
  unpaid:  { label: '미입금',   color: 'text-red-600 bg-red-50',      icon: Clock },
}

const PRESETS = [
  { name: '실내청소',   price: INTERIOR_PRICE },
  { name: '유리막코팅', price: 30000 },
  { name: '타이어광택', price: 10000 },
]

export default function BillingPage() {
  const supabase = createClient()
  const [yearMonth,   setYearMonth]   = useState(getCurrentYearMonth())
  const [allCustomers, setAllCustomers] = useState<CustomerBilling[]>([])
  const [loading,     setLoading]     = useState(true)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [addingItem,  setAddingItem]  = useState<Record<string, NewItem>>({})
  const [showAddForm, setShowAddForm] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingMemo, setEditingMemo] = useState<Record<string, string>>({})
  const [savingMemo,  setSavingMemo]  = useState<Record<string, boolean>>({})

  // localStorage에서 고객 메모 로드/저장
  const getMemoKey = (customerId: string) => `billing_memo:${yearMonth}:${customerId}`
  const loadMemo = (customerId: string) => {
    try {
      return localStorage.getItem(getMemoKey(customerId)) || ''
    } catch {
      return ''
    }
  }
  const saveMemoToStorage = (customerId: string, memo: string) => {
    try {
      localStorage.setItem(getMemoKey(customerId), memo)
    } catch {}
  }

  const fetchBilling = useCallback(async () => {
    setLoading(true)
    const [y, m] = yearMonth.split('-')
    const startDate = `${y}-${m}-01`
    const endDate   = new Date(parseInt(y), parseInt(m), 0).toISOString().split('T')[0]

    const [vRes, rRes, bRes] = await Promise.all([
      supabase.from('vehicles').select('*, customer:customers(*)'),
      supabase.from('wash_records')
        .select('*')
        .gte('wash_date', startDate)
        .lte('wash_date', endDate)
        .order('wash_date'),
      supabase.from('billings')
        .select('*, items:billing_items(*)')
        .eq('year_month', yearMonth),
    ])

    const vehicles = (vRes.data ?? []) as Array<Vehicle & { customer: Customer }>
    const records = (rRes.data ?? []) as WashRecord[]
    const billings = (bRes.data ?? []) as Array<Billing & { items?: BillingItem[] }>

    // 차량별 청구 정보 구성
    const vehicleBillings: Record<string, VehicleBilling> = {}
    vehicles.forEach(v => {
      const billing = billings.find(b => b.vehicle_id === v.id)
      const extraItems = (billing?.items ?? []) as BillingItem[]
      const vehicleRecords = records.filter(r => r.vehicle_id === v.id)
      const washTotal = vehicleRecords.reduce((s, r) => s + r.price, 0)
      const extraTotal = extraItems.reduce((s, i) => s + i.amount, 0)
      vehicleBillings[v.id] = {
        vehicle: v,
        records: vehicleRecords,
        extraItems,
        washTotal,
        extraTotal,
        totalAmount: washTotal + extraTotal,
        paymentStatus: billing?.payment_status ?? 'unpaid',
        paidAmount: billing?.paid_amount ?? 0,
        billingId: billing?.id ?? null,
      }
    })

    // 고객별로 그룹화
    const byCustomer: Record<string, CustomerBilling> = {}
    Object.values(vehicleBillings).forEach(vb => {
      const cid = vb.vehicle.customer_id
      if (!byCustomer[cid]) {
        const customer = vb.vehicle.customer
        byCustomer[cid] = {
          customerId: cid,
          customer: customer || { id: cid, name: '고객', phone: null },
          vehicles: [],
          totalAmount: 0,
          totalRecords: 0,
          paymentStatus: 'unpaid',
          memo: loadMemo(cid),
        }
      }
      byCustomer[cid].vehicles.push(vb)
      byCustomer[cid].totalAmount += vb.totalAmount
      byCustomer[cid].totalRecords += vb.records.length
    })

    setAllCustomers(Object.values(byCustomer).sort((a, b) => 
      (a.customer.name ?? '').localeCompare(b.customer.name ?? '')
    ))
    setLoading(false)
  }, [yearMonth])

  useEffect(() => { fetchBilling() }, [fetchBilling])

  function changeMonth(delta: number) {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // 검색 필터링
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return allCustomers
    const q = searchQuery.toLowerCase()
    return allCustomers.filter(cb => {
      const matchCustomer = cb.customer.name?.toLowerCase().includes(q) || cb.customer.phone?.includes(q)
      const matchVehicle = cb.vehicles.some(vb =>
        vb.vehicle.car_name?.toLowerCase().includes(q) ||
        vb.vehicle.plate_number?.toLowerCase().includes(q)
      )
      return matchCustomer || matchVehicle
    })
  }, [allCustomers, searchQuery])

  async function ensureBilling(vb: VehicleBilling): Promise<string> {
    if (vb.billingId) return vb.billingId
    const { data } = await db()
      .from('billings')
      .insert({
        vehicle_id: vb.vehicle.id,
        year_month: yearMonth,
        wash_count: vb.records.length,
        total_amount: vb.totalAmount,
        payment_status: 'unpaid',
        paid_amount: 0,
      })
      .select('id')
      .single()
    return data?.id
  }

  async function updatePaymentStatus(vb: VehicleBilling, status: PaymentStatus) {
    if (vb.billingId) {
      await db().from('billings')
        .update({
          payment_status: status,
          paid_amount: status === 'paid' ? vb.totalAmount : vb.paidAmount,
          total_amount: vb.totalAmount,
          wash_count: vb.records.length,
        })
        .eq('id', vb.billingId)
    } else {
      await db().from('billings').insert({
        vehicle_id: vb.vehicle.id,
        year_month: yearMonth,
        wash_count: vb.records.length,
        total_amount: vb.totalAmount,
        payment_status: status,
        paid_amount: status === 'paid' ? vb.totalAmount : 0,
      })
    }
    fetchBilling()
  }

  async function addItem(vb: VehicleBilling, name: string, price: number, qty: number) {
    const billingId = await ensureBilling(vb)
    if (!billingId) return
    await db().from('billing_items').insert({
      billing_id: billingId,
      item_name: name,
      unit_price: price,
      quantity: qty,
      amount: price * qty,
    })
    await db().from('billings')
      .update({ total_amount: vb.totalAmount + price * qty })
      .eq('id', billingId)
    setShowAddForm(null)
    fetchBilling()
  }

  async function deleteItem(vb: VehicleBilling, itemId: string, amount: number) {
    await db().from('billing_items').delete().eq('id', itemId)
    if (vb.billingId) {
      await db().from('billings')
        .update({ total_amount: vb.totalAmount - amount })
        .eq('id', vb.billingId)
    }
    fetchBilling()
  }

  async function saveMemo(customerId: string) {
    const memo = editingMemo[customerId] ?? ''
    setSavingMemo(prev => ({ ...prev, [customerId]: true }))
    saveMemoToStorage(customerId, memo)
    // 로컬 데이터 업데이트
    setAllCustomers(prev => prev.map(cb => 
      cb.customerId === customerId ? { ...cb, memo } : cb
    ))
    setEditingMemo(prev => {
      const updated = { ...prev }
      delete updated[customerId]
      return updated
    })
    setTimeout(() => setSavingMemo(prev => {
      const updated = { ...prev }
      delete updated[customerId]
      return updated
    }), 1000)
  }

  function buildKakaoMessage(cb: CustomerBilling): string {
    const [, m] = yearMonth.split('-')
    const lines: string[] = []
    lines.push(`[새차처럼] ${parseInt(m)}월 세차 청구 안내`)
    lines.push(''.repeat(20))
    lines.push(`고객명: ${cb.customer.name} 님`)
    if (cb.customer.phone) lines.push(`연락처: ${cb.customer.phone}`)
    lines.push(''.repeat(20))
    
    cb.vehicles.forEach(vb => {
      if (vb.records.length > 0) {
        lines.push(`[${vb.vehicle.car_name}] ${vb.vehicle.plate_number}`)
        vb.records.forEach(r => {
          const d = new Date(r.wash_date)
          const basePrice = vb.vehicle.unit_price ?? 0
          const interiorAmt = r.price - basePrice
          if (interiorAmt > 0) {
            lines.push(`   ${parseInt(m)}/${d.getDate()} 세차: ${formatPrice(basePrice)} + 실내 ${formatPrice(interiorAmt)}`)
          } else {
            lines.push(`   ${parseInt(m)}/${d.getDate()} 세차: ${formatPrice(r.price)}`)
          }
        })
        if (vb.extraItems.length > 0) {
          vb.extraItems.forEach(item => {
            lines.push(`   ${item.item_name}${item.quantity > 1 ? ` ${item.quantity}` : ''}: ${formatPrice(item.amount)}`)
          })
        }
        lines.push(`  소계: ${formatPrice(vb.totalAmount)}`)
        lines.push('')
      }
    })
    
    lines.push(''.repeat(20))
    lines.push(`총 청구금액: ${formatPrice(cb.totalAmount)}`)
    lines.push('입금계좌: (계좌 정보)')
    lines.push(''.repeat(20))
    return lines.join('\n')
  }

  async function copyKakao(cb: CustomerBilling) {
    const msg = buildKakaoMessage(cb)
    await navigator.clipboard.writeText(msg)
    alert('클립보드에 복사되었습니다. 카카오톡에 붙여넣기 하세요.')
  }

  const totalCustomers = filteredCustomers.length
  const totalUnpaid = filteredCustomers.filter(c => c.paymentStatus !== 'paid').reduce((s, c) => s + c.vehicles.filter(v => v.paymentStatus !== 'paid').length, 0)
  const totalPaid = filteredCustomers.filter(c => c.paymentStatus === 'paid').reduce((s, c) => s + c.vehicles.filter(v => v.paymentStatus === 'paid').length, 0)

  return (
    <div className="p-4 max-w-3xl mx-auto pb-24">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">청구 현황</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-800 min-w-[80px] text-center">
            {formatYearMonth(yearMonth)}
          </span>
          <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronRight size={20} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          type="text"
          placeholder="고객명, 차량명, 번호판으로 검색..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{totalCustomers}</div>
          <div className="text-xs text-gray-500 mt-0.5">전체 고객</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{totalUnpaid}</div>
          <div className="text-xs text-red-500 mt-0.5">미입금</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{totalPaid}</div>
          <div className="text-xs text-green-500 mt-0.5">입금완료</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {searchQuery ? '검색 결과가 없습니다' : '이번 달 세차 실적이 없습니다'}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCustomers.map(cb => {
            const isExpanded = selectedCustomerId === cb.customerId
            const unPaidVehicles = cb.vehicles.filter(v => v.paymentStatus !== 'paid').length
            return (
              <div key={cb.customerId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* 고객 헤더 */}
                <button
                  onClick={() => setSelectedCustomerId(isExpanded ? null : cb.customerId)}
                  className="w-full flex items-start justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-lg font-bold text-gray-900">{cb.customer.name}</span>
                      {cb.customer.phone && (
                        <span className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {cb.customer.phone}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {cb.vehicles.length}개 차량  {cb.totalRecords}회 세차
                      {unPaidVehicles > 0 && <span className="ml-1 text-red-500 font-medium">미입금 {unPaidVehicles}개</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <div className="text-right">
                      <div className="font-bold text-gray-900">{formatPrice(cb.totalAmount)}</div>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        copyKakao(cb)
                      }}
                      className="text-yellow-600 hover:text-yellow-700 p-1 rounded hover:bg-yellow-50"
                      title="카톡 전송"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </button>

                {/* 고객 상세 - 펼침 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-4">
                    {/* 메모 섹션 */}
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <div className="flex items-start justify-between mb-2">
                        <label className="text-xs font-semibold text-blue-700">고객 메모 (요청사항)</label>
                        {editingMemo[cb.customerId] !== undefined ? (
                          <button
                            onClick={() => saveMemo(cb.customerId)}
                            disabled={savingMemo[cb.customerId]}
                            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                          >
                            <Save size={12} />
                            {savingMemo[cb.customerId] ? '저장 중...' : '저장'}
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingMemo(prev => ({ ...prev, [cb.customerId]: cb.memo || '' }))}
                            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700"
                          >
                            <Edit2 size={12} />
                            수정
                          </button>
                        )}
                      </div>
                      {editingMemo[cb.customerId] !== undefined ? (
                        <textarea
                          value={editingMemo[cb.customerId]}
                          onChange={e => setEditingMemo(prev => ({ ...prev, [cb.customerId]: e.target.value }))}
                          className="w-full border border-blue-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={2}
                          placeholder="고객 요청사항을 입력하세요"
                        />
                      ) : (
                        <p className="text-sm text-blue-900 min-h-8">
                          {cb.memo || <span className="text-blue-400">메모가 없습니다</span>}
                        </p>
                      )}
                    </div>

                    {/* 등록 차량 목록 */}
                    <div className="space-y-3">
                      {cb.vehicles.map(vb => {
                        const v = vb.vehicle
                        const cfg = STATUS_CONFIG[vb.paymentStatus]
                        const Icon = cfg.icon
                        const isVehicleSelected = selectedVehicleId === v.id
                        const isAdding = showAddForm === v.id
                        const newItem = addingItem[v.id] ?? { name: '', price: '', qty: '1' }

                        return (
                          <div key={v.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            {/* 차량 요약 */}
                            <button
                              onClick={() => setSelectedVehicleId(isVehicleSelected ? null : v.id)}
                              className="w-full flex items-start justify-between p-3 text-left hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                  <span className="font-semibold text-gray-900">{v.car_name}</span>
                                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{v.plate_number}</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {CAR_GRADE_LABELS[v.car_grade]}  {MONTHLY_COUNT_LABELS[v.monthly_count]}  {vb.records.length}회 세차
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <span className="font-semibold text-gray-900 text-sm">{formatPrice(vb.totalAmount)}</span>
                                <span className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded font-medium ${cfg.color}`}>
                                  <Icon size={11} />{cfg.label}
                                </span>
                              </div>
                            </button>

                            {/* 차량 상세 */}
                            {isVehicleSelected && (
                              <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
                                {/* 세차 실적 */}
                                <div>
                                  <p className="text-xs font-semibold text-gray-600 mb-2">세차 실적</p>
                                  <div className="space-y-1">
                                    {vb.records.map(r => {
                                      const d = new Date(r.wash_date)
                                      const basePrice = v.unit_price ?? 0
                                      const interiorAmt = r.price - basePrice
                                      return (
                                        <div key={r.id} className="flex justify-between text-sm bg-white rounded px-2 py-1">
                                          <span className="text-gray-600">
                                            {d.getMonth() + 1}/{d.getDate()}
                                            {interiorAmt > 0 && <span className="ml-1 text-purple-600">(실내)</span>}
                                          </span>
                                          <span className="font-medium text-gray-900">{formatPrice(r.price)}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                  <div className="flex justify-between mt-1.5 text-xs font-semibold bg-white rounded px-2 py-1">
                                    <span>세차 소계</span>
                                    <span className="text-blue-600">{formatPrice(vb.washTotal)}</span>
                                  </div>
                                </div>

                                {/* 추가 항목 */}
                                {vb.extraItems.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 mb-1.5">추가 서비스</p>
                                    <div className="space-y-1">
                                      {vb.extraItems.map(item => (
                                        <div key={item.id} className="flex items-center justify-between text-sm bg-white rounded px-2 py-1">
                                          <span className="text-gray-700">
                                            {item.item_name}{item.quantity > 1 && ` ${item.quantity}`}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900">{formatPrice(item.amount)}</span>
                                            <button
                                              onClick={() => deleteItem(vb, item.id, item.amount)}
                                              className="text-red-500 hover:text-red-700 p-0.5"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* 추가 항목 폼 */}
                                {isAdding ? (
                                  <div className="bg-white rounded-lg p-2 space-y-2 border border-blue-200">
                                    <div className="grid grid-cols-3 gap-1.5">
                                      <input
                                        type="text"
                                        placeholder="항목명"
                                        value={newItem.name}
                                        onChange={e => setAddingItem(p => ({ ...p, [v.id]: { ...newItem, name: e.target.value } }))}
                                        className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                      <input
                                        type="number"
                                        placeholder="가격"
                                        value={newItem.price}
                                        onChange={e => setAddingItem(p => ({ ...p, [v.id]: { ...newItem, price: e.target.value } }))}
                                        className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                      <input
                                        type="number"
                                        placeholder="수량"
                                        value={newItem.qty}
                                        onChange={e => setAddingItem(p => ({ ...p, [v.id]: { ...newItem, qty: e.target.value } }))}
                                        className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => addItem(vb, newItem.name, Number(newItem.price), Number(newItem.qty))}
                                        disabled={!newItem.name || !newItem.price}
                                        className="flex-1 bg-blue-600 text-white py-1 rounded text-xs font-medium hover:bg-blue-700 disabled:bg-gray-300"
                                      >
                                        추가
                                      </button>
                                      <button
                                        onClick={() => setShowAddForm(null)}
                                        className="flex-1 border border-gray-300 rounded text-xs font-medium hover:bg-gray-50"
                                      >
                                        취소
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => setShowAddForm(v.id)}
                                      className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-blue-600 border border-blue-300 rounded py-1 hover:bg-blue-50"
                                    >
                                      <Plus size={14} />
                                      항목 추가
                                    </button>
                                    {['paid', 'unpaid', 'partial'].map(status => (
                                      <button
                                        key={status}
                                        onClick={() => updatePaymentStatus(vb, status as PaymentStatus)}
                                        className="text-xs px-2 py-1 rounded font-medium border transition-colors"
                                        style={{
                                          borderColor: STATUS_CONFIG[status as PaymentStatus].color.split(' ')[0].replace('text-', 'border-').replace('600', '300'),
                                          color: STATUS_CONFIG[status as PaymentStatus].color.split(' ')[0].replace('text-', 'text-').replace('bg-', ''),
                                        }}
                                      >
                                        {STATUS_CONFIG[status as PaymentStatus].label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}