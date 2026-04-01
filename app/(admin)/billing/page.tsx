'use client'

// Design Ref: §5.3 — 청구 현황 (월별, POS식 정산)
// Plan SC: SC-03 월말 정산 금액 자동 계산

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle, Clock, AlertCircle, Plus, Trash2, X } from 'lucide-react'
import { createClient, db } from '@/lib/supabase/client'
import { CAR_GRADE_LABELS, MONTHLY_COUNT_LABELS, INTERIOR_PRICE } from '@/lib/constants/pricing'
import { formatPrice, formatYearMonth, getCurrentYearMonth } from '@/lib/utils'
import type { Vehicle, WashRecord, Billing, BillingItem, PaymentStatus } from '@/types'

interface BillingSummary {
  vehicle:       Vehicle
  records:       WashRecord[]
  extraItems:    BillingItem[]
  washTotal:     number
  extraTotal:    number
  totalAmount:   number
  paymentStatus: PaymentStatus
  paidAmount:    number
  billingId:     string | null
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
  const [summaries,   setSummaries]   = useState<BillingSummary[]>([])
  const [loading,     setLoading]     = useState(true)
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [addingItem,  setAddingItem]  = useState<Record<string, NewItem>>({})
  const [showAddForm, setShowAddForm] = useState<string | null>(null)

  useEffect(() => { fetchBilling() }, [yearMonth])

  async function fetchBilling() {
    setLoading(true)
    const [y, m] = yearMonth.split('-')
    const startDate = `${y}-${m}-01`
    const endDate   = new Date(parseInt(y), parseInt(m), 0).toISOString().split('T')[0]

    const { data: records } = await supabase
      .from('wash_records')
      .select('*, vehicle:vehicles(*, customer:customers(*))')
      .gte('wash_date', startDate)
      .lte('wash_date', endDate)
      .order('wash_date')

    const { data: billings } = await supabase
      .from('billings')
      .select('*, items:billing_items(*)')
      .eq('year_month', yearMonth)

    const byVehicle: Record<string, BillingSummary> = {}
    const billingRows = (billings ?? []) as Array<Billing & { items?: BillingItem[] }>
    const recordRows  = (records ?? []) as Array<WashRecord & { vehicle: Vehicle & { customer: { name: string } } }>

    recordRows.forEach(r => {
      if (!r.vehicle) return
      if (!byVehicle[r.vehicle_id]) {
        const billing    = billingRows.find(b => b.vehicle_id === r.vehicle_id)
        const extraItems = (billing?.items ?? []) as BillingItem[]
        const extraTotal = extraItems.reduce((sum, i) => sum + i.amount, 0)
        byVehicle[r.vehicle_id] = {
          vehicle:       r.vehicle,
          records:       [],
          extraItems,
          washTotal:     0,
          extraTotal,
          totalAmount:   extraTotal,
          paymentStatus: billing?.payment_status ?? 'unpaid',
          paidAmount:    billing?.paid_amount ?? 0,
          billingId:     billing?.id ?? null,
        }
      }
      byVehicle[r.vehicle_id].records.push(r as WashRecord)
      byVehicle[r.vehicle_id].washTotal  += r.price
      byVehicle[r.vehicle_id].totalAmount += r.price
    })

    setSummaries(Object.values(byVehicle))
    setLoading(false)
  }

  function changeMonth(delta: number) {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  async function ensureBilling(summary: BillingSummary): Promise<string> {
    if (summary.billingId) return summary.billingId
    const { data } = await db()
      .from('billings')
      .insert({
        vehicle_id:     summary.vehicle.id,
        year_month:     yearMonth,
        wash_count:     summary.records.length,
        total_amount:   summary.totalAmount,
        payment_status: 'unpaid',
        paid_amount:    0,
      })
      .select('id')
      .single()
    return data.id
  }

  async function updatePaymentStatus(summary: BillingSummary, status: PaymentStatus) {
    if (summary.billingId) {
      await db().from('billings')
        .update({
          payment_status: status,
          paid_amount: status === 'paid' ? summary.totalAmount : summary.paidAmount,
          total_amount: summary.totalAmount,
          wash_count: summary.records.length,
        })
        .eq('id', summary.billingId)
    } else {
      await db().from('billings').insert({
        vehicle_id:     summary.vehicle.id,
        year_month:     yearMonth,
        wash_count:     summary.records.length,
        total_amount:   summary.totalAmount,
        payment_status: status,
        paid_amount:    status === 'paid' ? summary.totalAmount : 0,
      })
    }
    fetchBilling()
  }

  async function addItem(summary: BillingSummary, name: string, price: number, qty: number) {
    const billingId = await ensureBilling(summary)
    await db().from('billing_items').insert({
      billing_id: billingId,
      item_name:  name,
      unit_price: price,
      quantity:   qty,
      amount:     price * qty,
    })
    await db().from('billings')
      .update({ total_amount: summary.totalAmount + price * qty })
      .eq('id', billingId)
    setShowAddForm(null)
    fetchBilling()
  }

  async function deleteItem(summary: BillingSummary, itemId: string, amount: number) {
    await db().from('billing_items').delete().eq('id', itemId)
    if (summary.billingId) {
      await db().from('billings')
        .update({ total_amount: summary.totalAmount - amount })
        .eq('id', summary.billingId)
    }
    fetchBilling()
  }

  const totalUnpaid = summaries.filter(s => s.paymentStatus !== 'paid').length
  const totalPaid   = summaries.filter(s => s.paymentStatus === 'paid').length

  return (
    <div className="p-4 max-w-2xl mx-auto">
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

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{summaries.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">전체</div>
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
      ) : summaries.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">이번 달 세차 실적이 없습니다</div>
      ) : (
        <div className="space-y-3">
          {summaries.map(s => {
            const v        = s.vehicle
            const cfg      = STATUS_CONFIG[s.paymentStatus]
            const Icon     = cfg.icon
            const isSelected = selectedId === v.id
            const isAdding   = showAddForm === v.id
            const newItem    = addingItem[v.id] ?? { name: '', price: '', qty: '1' }

            return (
              <div key={v.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* 요약 행 */}
                <button
                  onClick={() => setSelectedId(isSelected ? null : v.id)}
                  className="w-full flex items-start justify-between p-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-900">{((s.vehicle as any).customer?.name) ?? '고객'}님</span>
                      {((s.vehicle as any).customer?.phone) && (
                        <span className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {((s.vehicle as any).customer?.phone)}
                        </span>
                      )}
                      <span className="font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded text-sm">
                        {v.car_name}
                      </span>
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{v.plate_number}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {CAR_GRADE_LABELS[v.car_grade]} · {MONTHLY_COUNT_LABELS[v.monthly_count]} · {s.records.length}회 세차
                      {s.extraItems.length > 0 && <span className="ml-1 text-blue-500">+ 추가 {s.extraItems.length}건</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="font-bold text-gray-900 text-sm">{formatPrice(s.totalAmount)}</span>
                    <span className={`flex items-center gap-0.5 text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>
                      <Icon size={11} />{cfg.label}
                    </span>
                  </div>
                </button>

                {/* 상세 */}
                {isSelected && (
                  <div className="border-t border-gray-100 p-4 space-y-4">

                    {/* ① 세차 실적 */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">세차 실적</p>
                      <div className="space-y-1">
                        {s.records.map(r => {
                          const d = new Date(r.wash_date)
                          return (
                            <div key={r.id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">{d.getMonth()+1}월 {d.getDate()}일</span>
                              <span className="font-medium text-gray-800">{formatPrice(r.price)}</span>
                            </div>
                          )
                        })}
                        <div className="flex justify-between text-sm text-gray-500 pt-1 border-t border-gray-100">
                          <span>소계</span>
                          <span>{formatPrice(s.washTotal)}</span>
                        </div>
                      </div>
                    </div>

                    {/* ② 추가 항목 (POS) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">추가 항목</p>
                        <button
                          onClick={() => setShowAddForm(isAdding ? null : v.id)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {isAdding ? <X size={13} /> : <Plus size={13} />}
                          {isAdding ? '취소' : '항목 추가'}
                        </button>
                      </div>

                      {s.extraItems.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {s.extraItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between text-sm bg-blue-50 rounded-lg px-3 py-1.5">
                              <span className="text-gray-700">{item.item_name} × {item.quantity}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-blue-700">{formatPrice(item.amount)}</span>
                                <button
                                  onClick={() => deleteItem(s, item.id, item.amount)}
                                  className="text-gray-300 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm text-gray-500 pt-1 border-t border-gray-100">
                            <span>소계</span>
                            <span>{formatPrice(s.extraTotal)}</span>
                          </div>
                        </div>
                      )}

                      {isAdding && (
                        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                          <div className="flex gap-1.5 flex-wrap">
                            {PRESETS.map(p => (
                              <button
                                key={p.name}
                                onClick={() => setAddingItem(prev => ({
                                  ...prev,
                                  [v.id]: { name: p.name, price: String(p.price), qty: '1' }
                                }))}
                                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1 hover:border-blue-300 hover:text-blue-600 transition-colors"
                              >
                                {p.name} {formatPrice(p.price)}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            placeholder="항목명 (예: 실내청소)"
                            value={newItem.name}
                            onChange={e => setAddingItem(prev => ({ ...prev, [v.id]: { ...newItem, name: e.target.value } }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="단가"
                              value={newItem.price}
                              onChange={e => setAddingItem(prev => ({ ...prev, [v.id]: { ...newItem, price: e.target.value } }))}
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <input
                              type="number"
                              placeholder="수량"
                              value={newItem.qty}
                              min={1}
                              onChange={e => setAddingItem(prev => ({ ...prev, [v.id]: { ...newItem, qty: e.target.value } }))}
                              className="w-16 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
                          <button
                            onClick={() => {
                              const price = parseInt(newItem.price)
                              const qty   = parseInt(newItem.qty) || 1
                              if (!newItem.name.trim() || !price) return
                              addItem(s, newItem.name.trim(), price, qty)
                              setAddingItem(prev => ({ ...prev, [v.id]: { name: '', price: '', qty: '1' } }))
                            }}
                            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                          >
                            추가
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ③ 합계 */}
                    <div className="flex items-center justify-between py-2 border-t-2 border-gray-200">
                      <span className="font-bold text-gray-900">청구 합계</span>
                      <span className="text-lg font-bold text-blue-700">{formatPrice(s.totalAmount)}</span>
                    </div>

                    {/* ④ 입금 상태 */}
                    <div className="grid grid-cols-3 gap-2">
                      {(['unpaid', 'partial', 'paid'] as PaymentStatus[]).map(status => (
                        <button
                          key={status}
                          onClick={() => updatePaymentStatus(s, status)}
                          className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                            s.paymentStatus === status
                              ? STATUS_CONFIG[status].color + ' border-current'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {STATUS_CONFIG[status].label}
                        </button>
                      ))}
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
