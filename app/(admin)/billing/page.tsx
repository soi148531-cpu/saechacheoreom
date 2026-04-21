'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle, Clock, AlertCircle, Plus, Trash2, Copy, Edit2, Save, Search, TrendingUp } from 'lucide-react'
import { createClient, db } from '@/lib/supabase/client'
import { CAR_GRADE_LABELS, MONTHLY_COUNT_LABELS } from '@/lib/constants/pricing'
import { formatPrice, formatYearMonth, getCurrentYearMonth } from '@/lib/utils'
import { MessageBadge } from '@/components/MessageBadge'
import { MessageButton } from '@/components/MessageButton'
import { buildDetailedBillingMessage } from '@/lib/services/messageService'
import type { Vehicle, WashRecord, Billing, BillingItem, PaymentStatus, PaymentMethod, Customer, MessageFilter } from '@/types'

interface PartialPayment {
  date: string   // YYYY-MM-DD
  amount: number
}

interface VehicleBilling {
  vehicle: Vehicle
  records: WashRecord[]
  scheduledDates: string[]   // 이달 예정 날짜 (schedules 테이블)
  extraItems: BillingItem[]
  washTotal: number
  extraTotal: number
  totalAmount: number
  paymentStatus: PaymentStatus
  paidAmount: number
  paidAt: string | null
  paymentMethod: PaymentMethod
  sentAt: string | null
  messageSentAt: string | null
  billingId: string | null
  partialHistory: PartialPayment[]  // 부분납 이력
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

interface BillingStats {
  totalBillingAmount: number
  totalPaidAmount: number
  unpaidAmount: number
  unpaidCount: number
  partialCount: number
  paidCount: number
  paymentRate: number
  totalRecords: number
}

interface NewItem { name: string; price: string; qty: string }

// 통계 계산 함수
function calculateBillingStats(customers: CustomerBilling[]): BillingStats {
  let totalBillingAmount = 0
  let totalPaidAmount = 0
  let unpaidCount = 0
  let partialCount = 0
  let paidCount = 0
  let totalRecords = 0

  customers.forEach(cb => {
    cb.vehicles.forEach(vb => {
      totalBillingAmount += vb.totalAmount
      totalPaidAmount += vb.paidAmount
      totalRecords += vb.records.length

      if (vb.paymentStatus === 'paid') paidCount++
      else if (vb.paymentStatus === 'partial') partialCount++
      else unpaidCount++
    })
  })

  const unpaidAmount = totalBillingAmount - totalPaidAmount
  const paymentRate = totalBillingAmount > 0 ? (totalPaidAmount / totalBillingAmount) * 100 : 0

  return {
    totalBillingAmount,
    totalPaidAmount,
    unpaidAmount,
    unpaidCount,
    partialCount,
    paidCount,
    paymentRate,
    totalRecords,
  }
}

// 통계 카드 컴포넌트
function BillingStatistics({ stats, yearMonth }: { stats: BillingStats; yearMonth: string }) {
  const [y, m] = yearMonth.split('-')
  const monthDisplay = `${y}년 ${parseInt(m)}월`

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
      {/* 월 표시 */}
      <div className="mb-4">
        <p className="text-sm text-gray-500">{monthDisplay} 청구 현황</p>
      </div>

      {/* 3열 통계 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* 총 청구액 */}
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs text-gray-600 mb-1">총 청구액</p>
          <p className="text-lg font-bold text-blue-900">{formatPrice(stats.totalBillingAmount)}</p>
        </div>

        {/* 실제 입금액 - HIGHLIGHT */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border-2 border-green-500 shadow-md">
          <p className="text-xs text-gray-600 mb-1 font-semibold">실제 입금액</p>
          <p className="text-lg font-bold text-green-700">{formatPrice(stats.totalPaidAmount)}</p>
          <p className="text-xs text-green-600 mt-1 font-medium">
            {stats.partialCount > 0 && `부분납 ${stats.partialCount}대 | `}완납 {stats.paidCount}대
          </p>
        </div>

        {/* 미입금액 */}
        <div className="bg-red-50 rounded-lg p-3 border border-red-100">
          <p className="text-xs text-gray-600 mb-1">미입금액</p>
          <p className="text-lg font-bold text-red-900">{formatPrice(stats.unpaidAmount)}</p>
          <p className="text-xs text-red-600 mt-1">미입금: {stats.unpaidCount}대 / 부분납: {stats.partialCount}대</p>
        </div>
      </div>

      {/* 입금률 진행 바 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-700">입금 진행률</p>
          <p className="text-sm font-bold text-green-600">{stats.paymentRate.toFixed(1)}%</p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-gradient-to-r from-green-400 to-green-600 h-2.5 rounded-full transition-all"
            style={{ width: `${Math.min(stats.paymentRate, 100)}%` }}
          />
        </div>
      </div>

      {/* 세차 실적 */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600">이달 세차 실적</span>
        <span className="font-bold text-gray-900 flex items-center gap-1">
          <TrendingUp size={14} className="text-green-600" />
          {stats.totalRecords}건
        </span>
      </div>
    </div>
  )
}

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  paid:    { label: '입금완료', color: 'text-green-600 bg-green-50',   icon: CheckCircle },
  partial: { label: '부분납',   color: 'text-yellow-600 bg-yellow-50', icon: AlertCircle },
  unpaid:  { label: '미입금',   color: 'text-red-600 bg-red-50',      icon: Clock },
}

function StatusBadge({ vb }: { vb: VehicleBilling }) {
  const cfg = STATUS_CONFIG[vb.paymentStatus]
  const Icon = cfg.icon
  const label = vb.paymentStatus === 'partial' && vb.paidAmount > 0
    ? `부분납 ${vb.paidAmount.toLocaleString()}원`
    : cfg.label
  return (
    <span className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded font-medium ${cfg.color}`}>
      <Icon size={11} />{label}
    </span>
  )
}

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
  const [partialInput, setPartialInput] = useState<Record<string, string>>({}) // vehicleId → 입력금액
  const [partialDate,  setPartialDate]  = useState<Record<string, string>>({}) // vehicleId → 날짜
  const [paymentModal, setPaymentModal] = useState<VehicleBilling | null>(null)
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'card' | 'cash_receipt'>('all')
  const [messageFilter, setMessageFilter] = useState<MessageFilter>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid' | 'wash_done'>('all')
  const [modalPaymentDate, setModalPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [modalPaymentMethod, setModalPaymentMethod] = useState<'cash' | 'card' | 'cash_receipt'>('cash')

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

    const [vRes, rRes, bRes, sRes] = await Promise.all([
      supabase.from('vehicles').select('*, customer:customers(*)'),
      supabase.from('wash_records')
        .select('*')
        .gte('wash_date', startDate)
        .lte('wash_date', endDate)
        .order('wash_date'),
      supabase.from('billings')
        .select('*, items:billing_items(*)')
        .eq('year_month', yearMonth),
      supabase.from('schedules')
        .select('vehicle_id, scheduled_date')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .eq('is_deleted', false),
    ])

    const vehicles = (vRes.data ?? []) as Array<Vehicle & { customer: Customer }>
    const records = (rRes.data ?? []) as WashRecord[]
    const billings = (bRes.data ?? []) as any[]
    const scheduleData = (sRes.data ?? []) as Array<{ vehicle_id: string; scheduled_date: string }>

    // 차량별 청구 정보 구성 (청구 월 이전 종료/세차없는 차량 제외)
    const vehicleBillings: Record<string, VehicleBilling> = {}
    vehicles.forEach(v => {
      // 필터링: 청구 월 이전에 이미 종료된 차량, 세차 실적 없는 차량만 제외
      // 정지 상태든, 종료 예정이든, 청구 월에 세차 기록이 있으면 표시
      if (v.end_date && v.end_date < startDate) return
      
      const vehicleRecords = records.filter(r => r.vehicle_id === v.id)
      if (vehicleRecords.length === 0) return
      
      const billing = billings.find(b => b.vehicle_id === v.id)
      const extraItems = (billing?.items ?? []) as BillingItem[]
      const washTotal = vehicleRecords.reduce((s, r) => s + r.price, 0)
      const extraTotal = extraItems.reduce((s, i) => s + i.amount, 0)
      const scheduledDates = scheduleData
        .filter(s => s.vehicle_id === v.id)
        .map(s => s.scheduled_date)
        .sort()
      vehicleBillings[v.id] = {
        vehicle: v,
        records: vehicleRecords,
        scheduledDates,
        extraItems,
        washTotal,
        extraTotal,
        totalAmount: washTotal + extraTotal,
        paymentStatus: billing?.payment_status ?? 'unpaid',
        paidAmount: billing?.paid_amount ?? 0,
        paidAt: billing?.paid_at ?? null,
        paymentMethod: (billing?.payment_method as PaymentMethod) ?? null,
        sentAt: billing?.sent_at ?? null,
        messageSentAt: billing?.message_sent_at ?? null,
        billingId: billing?.id ?? null,
        partialHistory: (billing?.partial_payment_history as PartialPayment[]) ?? [],
      }
    })

    // 고객별로 그룹화 (세차 실적이 있는 차량만)
    const byCustomer: Record<string, CustomerBilling> = {}
    Object.values(vehicleBillings).forEach(vb => {
      const cid = vb.vehicle.customer_id
      if (!byCustomer[cid]) {
        const customer = vb.vehicle.customer
        byCustomer[cid] = {
          customerId: cid,
          customer: (customer ?? { id: cid, name: '고객', phone: null, apartment: '', memo: null, created_at: '' }) as Customer,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth])

  useEffect(() => { fetchBilling() }, [fetchBilling])

  function changeMonth(delta: number) {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // 검색 + 결제수단 필터링 + 메시지 필터링
  const filteredCustomers = useMemo(() => {
    let result = allCustomers
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(cb => {
        const matchCustomer = cb.customer.name?.toLowerCase().includes(q) || cb.customer.phone?.includes(q)
        const matchVehicle = cb.vehicles.some(vb =>
          vb.vehicle.car_name?.toLowerCase().includes(q) ||
          vb.vehicle.plate_number?.toLowerCase().includes(q)
        )
        return matchCustomer || matchVehicle
      })
    }
    if (paymentFilter !== 'all') {
      result = result
        .map(cb => ({ ...cb, vehicles: cb.vehicles.filter(vb => vb.paymentMethod === paymentFilter) }))
        .filter(cb => cb.vehicles.length > 0)
    }
    if (messageFilter !== 'all') {
      result = result
        .map(cb => ({ ...cb, vehicles: cb.vehicles.filter(vb => {
          if (messageFilter === 'sent') return vb.messageSentAt !== null
          if (messageFilter === 'unsent') return vb.messageSentAt === null
          return true
        }) }))
        .filter(cb => cb.vehicles.length > 0)
    }
    return result
  }, [allCustomers, searchQuery, paymentFilter, messageFilter])

  // 차량이 이달 예정 횟수를 다 채웠는지 판단
  function isWashDone(vb: VehicleBilling): boolean {
    const mc = vb.vehicle.monthly_count
    if (mc === 'onetime' || mc === 'new_customer') return vb.records.length >= 1
    const required = mc === 'monthly_1' ? 1 : mc === 'monthly_2' ? 2 : 4
    return vb.records.length >= required
  }

  const displayedCustomers = useMemo(() => {
    if (statusFilter === 'unpaid') return filteredCustomers.filter(c => c.vehicles.some(v => v.paymentStatus === 'unpaid'))
    if (statusFilter === 'partial') return filteredCustomers.filter(c => c.vehicles.some(v => v.paymentStatus === 'partial'))
    if (statusFilter === 'paid') return filteredCustomers.filter(c => c.vehicles.every(v => v.paymentStatus === 'paid'))
    if (statusFilter === 'wash_done') {
      // 이달 세차 다 끝난 차량이 1개 이상인 고객
      const done = filteredCustomers
        .map(cb => ({ ...cb, vehicles: cb.vehicles.filter(vb => isWashDone(vb)) }))
        .filter(cb => cb.vehicles.length > 0)
      // 정렬: 카톡미발송+미입금 → 카톡발송+미입금 → 부분납 → 완납
      const rank = (cb: typeof done[0]) => {
        const v = cb.vehicles[0]
        if (v.paymentStatus === 'paid') return 3
        if (v.paymentStatus === 'partial') return 2
        if (v.messageSentAt) return 1
        return 0
      }
      return [...done].sort((a, b) => rank(a) - rank(b))
    }
    return filteredCustomers
  }, [filteredCustomers, statusFilter])

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

  async function updatePaymentStatus(vb: VehicleBilling, status: PaymentStatus, customPaidAmount?: number, paidAt?: string | null, payMethod?: PaymentMethod) {
    const paidAmount = status === 'paid'
      ? vb.totalAmount
      : status === 'partial'
        ? (customPaidAmount ?? vb.paidAmount)
        : 0
    const updateData: Record<string, unknown> = {
      payment_status: status,
      paid_amount: paidAmount,
      total_amount: vb.totalAmount,
      wash_count: vb.records.length,
    }
    if (status === 'unpaid') {
      updateData.paid_at = null
      updateData.payment_method = null
      updateData.partial_payment_history = []
    } else {
      if (paidAt !== undefined) updateData.paid_at = paidAt
      if (payMethod !== undefined) updateData.payment_method = payMethod
    }

    if (vb.billingId) {
      await db().from('billings').update(updateData).eq('id', vb.billingId)
    } else {
      await db().from('billings').insert({
        vehicle_id: vb.vehicle.id,
        year_month: yearMonth,
        wash_count: vb.records.length,
        total_amount: vb.totalAmount,
        payment_status: status,
        paid_amount: paidAmount,
        ...(paidAt !== undefined ? { paid_at: paidAt } : {}),
        ...(payMethod !== undefined ? { payment_method: payMethod } : {}),
      })
    }
    fetchBilling()
  }

  function openPaymentModal(vb: VehicleBilling) {
    setPaymentModal(vb)
    setModalPaymentDate(new Date().toISOString().split('T')[0])
    setModalPaymentMethod('cash')
  }

  async function confirmPaymentModal() {
    if (!paymentModal) return
    await updatePaymentStatus(paymentModal, 'paid', undefined, modalPaymentDate, modalPaymentMethod)
    setPaymentModal(null)
  }

  async function confirmPartial(vb: VehicleBilling) {
    const raw = partialInput[vb.vehicle.id] ?? ''
    const amount = parseInt(raw.replace(/,/g, ''), 10)
    if (isNaN(amount) || amount <= 0) return
    setPartialInput(prev => { const n = { ...prev }; delete n[vb.vehicle.id]; return n })
    setPartialDate(prev => { const n = { ...prev }; delete n[vb.vehicle.id]; return n })
    const today = new Date().toISOString().split('T')[0]
    const date = partialDate[vb.vehicle.id] || today
    // 기존 이력에 납부 추가
    const newHistory: PartialPayment[] = [...vb.partialHistory, { date, amount }]
    const totalPaid = newHistory.reduce((sum, p) => sum + p.amount, 0)
    const billingId = await ensureBilling(vb)
    await (db() as ReturnType<typeof db>).from('billings').update({
      payment_status: 'partial',
      paid_amount: totalPaid,
      paid_at: date,
      partial_payment_history: newHistory,
      total_amount: vb.totalAmount,
      wash_count: vb.records.length,
    }).eq('id', billingId)
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

    // localStorage + DB 함께 저장
    saveMemoToStorage(customerId, memo)
    const customer = allCustomers.find(c => c.customerId === customerId)
    if (customer) {
      customer.vehicles.forEach(vb => {
        if (vb.billingId) {
          db().from('billings')
            .update({ memo })
            .eq('id', vb.billingId)
            .catch((err: unknown) => console.error('메모 저장 실패:', err))
        }
      })
    }

    // 로컬 UI 업데이트
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

  async function copyKakao(cb: CustomerBilling) {
    const [, m] = yearMonth.split('-')
    const monthNum = parseInt(m, 10)

    const vehicleDetails = cb.vehicles.map(vb => ({
      carName: vb.vehicle.car_name || '',
      plateNumber: vb.vehicle.plate_number || '',
      records: vb.records.map(r => ({
        date: `${monthNum}/${new Date(r.wash_date).getDate()}`,
        price: r.price
      })),
      subtotal: vb.totalAmount
    }))

    const msg = await buildDetailedBillingMessage(
      cb.customer.name,
      cb.customer.phone || null,
      String(monthNum),
      vehicleDetails,
      cb.totalAmount
    )
    await navigator.clipboard.writeText(msg)
    alert('클립보드에 복사되었습니다. 카카오톡에 붙여넣기 하세요.')
  }

  async function handleMessageUpdate(billingId: string) {
    // 단일 항목만 새로고침 (효율성)
    const { data } = await supabase
      .from('billings')
      .select('*')
      .eq('id', billingId)
      .single()

    if (!data) return

    // allCustomers 배열 업데이트
    setAllCustomers(prev => prev.map(cb => ({
      ...cb,
      vehicles: cb.vehicles.map(vb => {
        if (vb.billingId === billingId) {
          return { ...vb, messageSentAt: (data as any).message_sent_at }
        }
        return vb
      })
    })))
  }

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    cash: '현금',
    card: '카드',
    cash_receipt: '현금영수증',
  }

  function copyTaxData() {
    const rows: string[] = ['입금날짜\t고객명\t금액\t증빙\t카톡발송']
    filteredCustomers.forEach(cb => {
      cb.vehicles.forEach(vb => {
        if (vb.paymentStatus !== 'paid') return
        const date = vb.paidAt ? new Date(vb.paidAt) : null
        const dateStr = date ? `${date.getMonth() + 1}/${date.getDate()}` : '-'
        const methodStr = vb.paymentMethod ? (PAYMENT_METHOD_LABELS[vb.paymentMethod] ?? vb.paymentMethod) : '-'
        const sentStr = vb.messageSentAt ? (() => { const d = new Date(vb.messageSentAt!); return `${d.getMonth()+1}/${d.getDate()}` })() : '-'
        rows.push(`${dateStr}\t${cb.customer.name}\t${vb.paidAmount}\t${methodStr}\t${sentStr}`)
      })
    })
    navigator.clipboard.writeText(rows.join('\n'))
    alert(`${rows.length - 1}건 복사됨. 구글 스프레드시트에 붙여넣기 하세요.`)
  }

  const totalCustomers = filteredCustomers.length
  const totalUnpaid = filteredCustomers.filter(c => c.vehicles.some(v => v.paymentStatus === 'unpaid')).length
  const totalPartial = filteredCustomers.filter(c => c.vehicles.some(v => v.paymentStatus === 'partial')).length
  const totalPaid = filteredCustomers.filter(c => c.vehicles.every(v => v.paymentStatus === 'paid')).length
  const totalWashDone = filteredCustomers.filter(c => c.vehicles.some(vb => isWashDone(vb))).length
  const billingStats = useMemo(() => calculateBillingStats(allCustomers), [allCustomers])

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

      {/* 통계 대시보드 */}
      <BillingStatistics stats={billingStats} yearMonth={yearMonth} />

      {/* 검색 */}
      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          type="text"
          placeholder="고객명, 차량명, 번호판으로 검색..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 결제수단 필터 탭 + 메시지 필터 탭 + 세금 복사 */}
      <div className="mb-4 space-y-2">
        {/* 결제수단 필터 */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 flex-1">
            {([['all', '전체'], ['cash', '현금'], ['card', '카드'], ['cash_receipt', '현금영수증']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setPaymentFilter(val)}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border transition-colors ${
                  paymentFilter === val
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={copyTaxData}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
            title="입금완료 건 스프레드시트용 복사"
          >
            <Copy size={13} />
            세금신고 복사
          </button>
        </div>

        {/* 메시지 필터 탭 */}
        <div className="flex gap-1">
          {([['all', '전체'], ['sent', '발송완료'], ['unsent', '미발송']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setMessageFilter(val)}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border transition-colors ${
                messageFilter === val
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        <button
          onClick={() => setStatusFilter('all')}
          className={`rounded-xl border p-3 text-center transition-all ${statusFilter === 'all' ? 'bg-gray-100 border-gray-400 ring-2 ring-gray-400' : 'bg-white border-gray-200 hover:border-gray-400'}`}
        >
          <div className="text-2xl font-bold text-gray-900">{totalCustomers}</div>
          <div className="text-xs text-gray-500 mt-0.5">전체</div>
        </button>
        <button
          onClick={() => setStatusFilter(prev => prev === 'unpaid' ? 'all' : 'unpaid')}
          className={`rounded-xl border p-3 text-center transition-all ${statusFilter === 'unpaid' ? 'bg-red-100 border-red-400 ring-2 ring-red-400' : 'bg-red-50 border-red-100 hover:border-red-400'}`}
        >
          <div className="text-2xl font-bold text-red-600">{totalUnpaid}</div>
          <div className="text-xs text-red-500 mt-0.5">미입금</div>
        </button>
        <button
          onClick={() => setStatusFilter(prev => prev === 'partial' ? 'all' : 'partial')}
          className={`rounded-xl border p-3 text-center transition-all ${statusFilter === 'partial' ? 'bg-yellow-100 border-yellow-400 ring-2 ring-yellow-400' : 'bg-yellow-50 border-yellow-100 hover:border-yellow-400'}`}
        >
          <div className="text-2xl font-bold text-yellow-600">{totalPartial}</div>
          <div className="text-xs text-yellow-600 mt-0.5">부분납</div>
        </button>
        <button
          onClick={() => setStatusFilter(prev => prev === 'paid' ? 'all' : 'paid')}
          className={`rounded-xl border p-3 text-center transition-all ${statusFilter === 'paid' ? 'bg-green-100 border-green-400 ring-2 ring-green-400' : 'bg-green-50 border-green-100 hover:border-green-400'}`}
        >
          <div className="text-2xl font-bold text-green-600">{totalPaid}</div>
          <div className="text-xs text-green-500 mt-0.5">완납</div>
        </button>
        <button
          onClick={() => setStatusFilter(prev => prev === 'wash_done' ? 'all' : 'wash_done')}
          className={`rounded-xl border p-3 text-center transition-all ${statusFilter === 'wash_done' ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-400' : 'bg-blue-50 border-blue-100 hover:border-blue-400'}`}
        >
          <div className="text-2xl font-bold text-blue-600">{totalWashDone}</div>
          <div className="text-xs text-blue-600 mt-0.5">세차완료</div>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : displayedCustomers.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {statusFilter !== 'all' ? (
            <span>해당 항목이 없습니다 <button onClick={() => setStatusFilter('all')} className="underline text-blue-500">전체 보기</button></span>

          ) : searchQuery ? '검색 결과가 없습니다' : '이번 달 세차 실적이 없습니다'}
        </div>
      ) : (
        <div className="space-y-3">
          {displayedCustomers.map(cb => {
            const isMemoOpen = selectedCustomerId === cb.customerId
            const unPaidVehicles = cb.vehicles.filter(v => v.paymentStatus !== 'paid').length
            return (
              <div key={cb.customerId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* 고객 헤더 — 클릭 시 메모만 토글 */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <button
                    onClick={() => setSelectedCustomerId(isMemoOpen ? null : cb.customerId)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <span className="text-base font-bold text-gray-900">{cb.customer.name}</span>
                    {cb.customer.phone && (
                      <span className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded shrink-0">
                        {cb.customer.phone}
                      </span>
                    )}
                    {cb.memo && <span className="text-blue-400 text-xs shrink-0">📝</span>}
                  </button>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-bold text-gray-900">{formatPrice(cb.totalAmount)}</span>
                    <button
                      onClick={() => copyKakao(cb)}
                      className="text-yellow-600 hover:text-yellow-700 p-1 rounded hover:bg-yellow-50"
                      title="카톡 복사"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                {/* 메모 — 클릭 시만 표시 */}
                {isMemoOpen && (
                  <div className="mx-3 mb-2 bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="flex items-start justify-between mb-1">
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
                      <p className="text-sm text-blue-900">
                        {cb.memo || <span className="text-blue-400">메모가 없습니다</span>}
                      </p>
                    )}
                  </div>
                )}

                {/* 차량 목록 — 항상 표시 */}
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {cb.vehicles.map(vb => {
                    const v = vb.vehicle
                    const isVehicleSelected = selectedVehicleId === v.id
                    const isAdding = showAddForm === v.id
                    const newItem = addingItem[v.id] ?? { name: '', price: '', qty: '1' }
                    const washDateSet = new Set(vb.records.map(r => r.wash_date))
                    // 예정 날짜 기준으로 표시 (있으면 예정 기준, 없으면 실적 기준 폴백)
                    const displayDates = vb.scheduledDates.length > 0
                      ? vb.scheduledDates
                      : vb.records.map(r => r.wash_date)
                    const allDone = displayDates.length > 0 && displayDates.every(d => washDateSet.has(d))

                    return (
                      <div key={v.id} className="px-3 py-2.5">
                        {/* 차량 정보 행 */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-gray-900 text-sm">{v.car_name}</span>
                              <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{v.plate_number}</span>
                              {/* 예정 날짜별 완료 표시 */}
                              {displayDates.map(date => {
                                const isDone = washDateSet.has(date)
                                const d = new Date(date)
                                const label = `${d.getMonth()+1}/${d.getDate()}`
                                return (
                                  <span
                                    key={date}
                                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                      isDone
                                        ? 'bg-green-100 text-green-600 line-through opacity-60'
                                        : 'bg-blue-50 text-blue-600'
                                    }`}
                                  >
                                    {label}
                                  </span>
                                )
                              })}
                              {allDone && displayDates.length > 0 && (
                                <span className="text-xs text-green-600 font-medium">✓완료</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {CAR_GRADE_LABELS[v.car_grade]} · {MONTHLY_COUNT_LABELS[v.monthly_count]}
                              {vb.paymentStatus === 'partial' && vb.partialHistory.length > 0
                                ? <span className="ml-1.5 font-medium text-yellow-700">
                                    부분납 {vb.partialHistory.map(p => { const d = new Date(p.date); return `${d.getMonth()+1}/${d.getDate()}(${p.amount.toLocaleString()}원)` }).join(', ')}
                                  </span>
                                : vb.paidAt && <span className="ml-1.5 font-medium text-green-700">입금 {(() => { const d = new Date(vb.paidAt!); return `${d.getMonth()+1}/${d.getDate()}` })()}</span>
                              }
                              {vb.paymentMethod && <span className="ml-1 text-gray-600">{PAYMENT_METHOD_LABELS[vb.paymentMethod]}</span>}
                              {vb.messageSentAt && <span className="ml-1 text-blue-500">카톡✓</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className="font-semibold text-gray-900 text-sm">{formatPrice(vb.totalAmount)}</span>
                            <StatusBadge vb={vb} />
                          </div>
                        </div>

                        {/* 액션 버튼 — 항상 표시 */}
                        {partialInput[v.id] !== undefined ? (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 space-y-2">
                            <p className="text-xs font-semibold text-yellow-800">부분납 입력 (전체: {formatPrice(vb.totalAmount)})</p>
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={partialDate[v.id] ?? new Date().toISOString().split('T')[0]}
                                onChange={e => setPartialDate(prev => ({ ...prev, [v.id]: e.target.value }))}
                                className="border border-yellow-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
                              />
                              <div className="relative flex-1">
                                <input
                                  type="number"
                                  placeholder="입금받은 금액"
                                  value={partialInput[v.id]}
                                  onChange={e => setPartialInput(prev => ({ ...prev, [v.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') confirmPartial(vb) }}
                                  className="w-full border border-yellow-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                  autoFocus
                                />
                                <span className="absolute right-2 top-1.5 text-xs text-gray-400">원</span>
                              </div>
                              <button onClick={() => confirmPartial(vb)} disabled={!partialInput[v.id]} className="bg-yellow-500 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-yellow-600 disabled:opacity-40">확인</button>
                              <button onClick={() => { setPartialInput(prev => { const n = { ...prev }; delete n[v.id]; return n }); setPartialDate(prev => { const n = { ...prev }; delete n[v.id]; return n }) }} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5">취소</button>
                            </div>
                          </div>
                        ) : isAdding ? (
                          <div className="bg-white rounded-lg p-2 space-y-2 border border-blue-200">
                            <div className="grid grid-cols-3 gap-1.5">
                              <input type="text" placeholder="항목명" value={newItem.name} onChange={e => setAddingItem(p => ({ ...p, [v.id]: { ...newItem, name: e.target.value } }))} className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              <input type="number" placeholder="가격" value={newItem.price} onChange={e => setAddingItem(p => ({ ...p, [v.id]: { ...newItem, price: e.target.value } }))} className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              <input type="number" placeholder="수량" value={newItem.qty} onChange={e => setAddingItem(p => ({ ...p, [v.id]: { ...newItem, qty: e.target.value } }))} className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => addItem(vb, newItem.name, Number(newItem.price), Number(newItem.qty))} disabled={!newItem.name || !newItem.price} className="flex-1 bg-blue-600 text-white py-1 rounded text-xs font-medium hover:bg-blue-700 disabled:bg-gray-300">추가</button>
                              <button onClick={() => setShowAddForm(null)} className="flex-1 border border-gray-300 rounded text-xs font-medium hover:bg-gray-50">취소</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-1 flex-wrap">
                            <button onClick={() => setShowAddForm(v.id)} className="flex items-center gap-0.5 text-xs px-2 py-1 rounded font-medium border border-blue-200 text-blue-600 hover:bg-blue-50">
                              <Plus size={12} />항목
                            </button>
                            <MessageButton
                              billingId={vb.billingId}
                              messageSentAt={vb.messageSentAt}
                              onEnsureBilling={() => ensureBilling(vb)}
                              onUpdate={handleMessageUpdate}
                            />
                            <button onClick={() => openPaymentModal(vb)} className="text-xs px-2 py-1 rounded font-medium border border-green-300 text-green-700 hover:bg-green-50">완납</button>
                            <button onClick={() => setPartialInput(prev => ({ ...prev, [v.id]: String(vb.paidAmount || '') }))} className="text-xs px-2 py-1 rounded font-medium border border-yellow-300 text-yellow-700 hover:bg-yellow-50">부분납</button>
                            <button onClick={() => updatePaymentStatus(vb, 'unpaid')} className="text-xs px-2 py-1 rounded font-medium border border-red-300 text-red-600 hover:bg-red-50">
                              {vb.paymentStatus === 'paid' ? '입금취소' : '미입금'}
                            </button>
                          </div>
                        )}

                        {/* 세차 실적 상세 — 차량 클릭 시 토글 */}
                        <button
                          onClick={() => setSelectedVehicleId(isVehicleSelected ? null : v.id)}
                          className="mt-1.5 text-xs text-gray-400 hover:text-gray-600"
                        >
                          {isVehicleSelected ? '▲ 세차 실적 닫기' : `▼ 세차 실적 보기 (${vb.records.length}건)`}
                        </button>

                        {isVehicleSelected && (
                          <div className="mt-2 bg-gray-50 rounded-lg p-2 space-y-1">
                            {vb.records.map(r => {
                              const d = new Date(r.wash_date)
                              return (
                                <div key={r.id} className="flex justify-between text-sm bg-white rounded px-2 py-1">
                                  <span className="text-gray-600 flex items-center gap-1">
                                    {d.getMonth() + 1}/{d.getDate()}
                                    {r.service_type === 'interior_only' && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">{(r as {memo?: string}).memo?.match(/^\[서비스:(.+?)\]/)?.[1] ?? '맞춤작업'}</span>}
                                    {r.service_type === 'interior' && <span className="text-xs text-purple-600">(+실내)</span>}
                                  </span>
                                  <span className="font-medium text-gray-900">{formatPrice(r.price)}</span>
                                </div>
                              )
                            })}
                            {vb.extraItems.length > 0 && vb.extraItems.map(item => (
                              <div key={item.id} className="flex items-center justify-between text-sm bg-white rounded px-2 py-1">
                                <span className="text-gray-700">{item.item_name}{item.quantity > 1 && ` ×${item.quantity}`}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{formatPrice(item.amount)}</span>
                                  <button onClick={() => deleteItem(vb, item.id, item.amount)} className="text-red-500 hover:text-red-700 p-0.5"><Trash2 size={12} /></button>
                                </div>
                              </div>
                            ))}
                            <div className="flex justify-between text-xs font-semibold bg-white rounded px-2 py-1">
                              <span>합계</span>
                              <span className="text-blue-600">{formatPrice(vb.totalAmount)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 입금 처리 모달 */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-bold text-gray-900 mb-1">입금 처리</h2>
            <p className="text-xs text-gray-500 mb-4">
              {paymentModal.vehicle.car_name} · {formatPrice(paymentModal.totalAmount)}
            </p>

            <label className="block text-xs font-semibold text-gray-700 mb-1">입금 날짜</label>
            <input
              type="date"
              value={modalPaymentDate}
              onChange={e => setModalPaymentDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            <label className="block text-xs font-semibold text-gray-700 mb-2">증빙 종류</label>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {([['cash', '현금'], ['card', '카드'], ['cash_receipt', '현금영수증']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setModalPaymentMethod(val)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                    modalPaymentMethod === val
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPaymentModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={confirmPaymentModal}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
              >
                입금완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}