'use client'

import { useState, useCallback, useEffect } from 'react'
import { Search, Sofa, User, Car, ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CAR_GRADE_LABELS, MONTHLY_COUNT_LABELS } from '@/lib/constants/pricing'
import { formatPrice, formatYearMonth, getCurrentYearMonth } from '@/lib/utils'
import type { Customer, Vehicle, WashRecord } from '@/types'

interface VehicleHistory {
  vehicle: Vehicle
  records: WashRecord[]
}

interface HistoryResult {
  customer: Customer
  vehicleHistories: VehicleHistory[]
}

interface TaxRow {
  id: string
  completedAt: string   // 표시용 문자열
  description: string   // 차량명 번호판 고객명 (호수)
  price: number
  paymentMethod: string | null
}

const PAYMENT_LABELS: Record<string, string> = {
  cash:         '현금',
  card:         '카드',
  cash_receipt: '현금영수증',
}

type Tab = 'history' | 'tax'

export default function HistoryPage() {
  const supabase = createClient()

  // ── 공통
  const [activeTab, setActiveTab] = useState<Tab>('history')

  // ── 이력 조회 탭
  const [query,    setQuery]    = useState('')
  const [result,   setResult]   = useState<HistoryResult | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState(false)

  // ── 세금신고 탭
  const [taxYearMonth, setTaxYearMonth] = useState(getCurrentYearMonth())
  const [taxRows,      setTaxRows]      = useState<TaxRow[]>([])
  const [taxLoading,   setTaxLoading]   = useState(false)
  const [copied,       setCopied]       = useState(false)

  // ── 이력 조회: 검색
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)

    const q = query.trim()
    let customerId: string | null = null

    const { data: customerByName } = await supabase
      .from('customers').select('*').ilike('name', `%${q}%`).limit(1)
    if (customerByName && customerByName.length > 0) {
      customerId = (customerByName[0] as Customer).id
    } else {
      const { data: vehicleByPlate } = await supabase
        .from('vehicles').select('*').ilike('plate_number', `%${q}%`).limit(1)
      if (vehicleByPlate && vehicleByPlate.length > 0) {
        customerId = (vehicleByPlate[0] as Vehicle).customer_id
      }
    }

    if (!customerId) { setResult(null); setLoading(false); return }

    const { data: customerData } = await supabase
      .from('customers').select('*, vehicles(*)').eq('id', customerId).single()
    if (!customerData) { setResult(null); setLoading(false); return }

    const customer = customerData as Customer
    const vehicles = (customer.vehicles ?? []) as Vehicle[]

    const vehicleHistories: VehicleHistory[] = await Promise.all(
      vehicles.map(async (vehicle) => {
        const { data: records } = await supabase
          .from('wash_records').select('*').eq('vehicle_id', vehicle.id)
          .order('wash_date', { ascending: false })
        return { vehicle, records: (records ?? []) as WashRecord[] }
      })
    )

    setResult({ customer, vehicleHistories })
    setLoading(false)
  }

  // ── 세금신고: 데이터 로드
  const fetchTaxData = useCallback(async () => {
    setTaxLoading(true)
    const [y, m] = taxYearMonth.split('-')
    const startDate = `${y}-${m}-01`
    const endDate   = new Date(parseInt(y), parseInt(m), 0).toISOString().split('T')[0]

    const [{ data: records }, { data: billings }] = await Promise.all([
      supabase
        .from('wash_records')
        .select('id, wash_date, completed_at, price, vehicle_id, vehicle:vehicles(car_name, plate_number, customer:customers(name, unit_number))')
        .gte('wash_date', startDate)
        .lte('wash_date', endDate)
        .order('wash_date', { ascending: true })
        .order('completed_at', { ascending: true }),
      supabase
        .from('billings')
        .select('vehicle_id, payment_method')
        .eq('year_month', taxYearMonth),
    ])

    const billingMap: Record<string, string | null> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(billings ?? []).forEach((b: any) => { billingMap[b.vehicle_id] = b.payment_method ?? null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: TaxRow[] = (records ?? []).map((r: any) => {
      const vehicle  = r.vehicle
      const customer = vehicle?.customer
      const unitPart = customer?.unit_number ? ` (${customer.unit_number})` : ''
      const description = `${vehicle?.car_name ?? ''} ${vehicle?.plate_number ?? ''} ${customer?.name ?? ''}${unitPart}`.trim()

      let completedAt = r.wash_date ?? ''
      if (r.completed_at) {
        const d = new Date(r.completed_at)
        completedAt = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
      }

      return {
        id: r.id,
        completedAt,
        description,
        price: r.price ?? 0,
        paymentMethod: billingMap[r.vehicle_id] ?? null,
      }
    })

    setTaxRows(rows)
    setTaxLoading(false)
  }, [taxYearMonth, supabase])

  useEffect(() => {
    if (activeTab === 'tax') fetchTaxData()
  }, [activeTab, fetchTaxData])

  function changeTaxMonth(delta: number) {
    const [y, m] = taxYearMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setTaxYearMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }

  function copyTaxTable() {
    const totalAmount = taxRows.reduce((sum, r) => sum + r.price, 0)
    const header = '일자\t항목/내역\t공급가액()\t공급대가(원)\t증빙종류\t비고\t월공급가액'
    const dataRows = taxRows.map((row, index) => {
      const methodLabel = row.paymentMethod ? (PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod) : '현금'
      const monthlyTotal = index === 0 ? `₩${totalAmount.toLocaleString()}` : ''
      return `${row.completedAt}\t${row.description}\t${row.price}\t${row.price.toLocaleString()} 원\t${methodLabel}\t승인\t${monthlyTotal}`
    })
    navigator.clipboard.writeText([header, ...dataRows].join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const totalRecords = result?.vehicleHistories.reduce((sum, vh) => sum + vh.records.length, 0) ?? 0
  const totalAmount  = result?.vehicleHistories.reduce(
    (sum, vh) => sum + vh.records.reduce((s, r) => s + r.price, 0), 0
  ) ?? 0
  const taxTotal = taxRows.reduce((sum, r) => sum + r.price, 0)

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">이력 조회</h1>

      {/* 탭 */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {([['history', '이력 조회'], ['tax', '세금신고 내역']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              activeTab === tab
                ? 'bg-white border-blue-500 text-blue-600 shadow-sm'
                : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 이력 조회 ───────────────────────── */}
      {activeTab === 'history' && (
        <div>
          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="고객명 또는 차량번호 입력"
                className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              검색
            </button>
          </form>

          {loading && <div className="text-center py-8 text-gray-400">검색 중...</div>}

          {!loading && searched && !result && (
            <div className="text-center py-8 text-gray-400 text-sm">
              일치하는 고객 또는 차량이 없습니다
            </div>
          )}

          {result && !loading && (
            <div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <User size={15} className="text-blue-500" />
                  <span className="text-lg font-bold text-gray-900">{result.customer.name}</span>
                  <span className="text-sm text-gray-500">{result.customer.apartment}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  {result.customer.phone && <span>{result.customer.phone}</span>}
                  <span className="flex items-center gap-1">
                    <Car size={13} className="text-blue-400" />
                    차량 {result.vehicleHistories.length}대
                  </span>
                  <span>전체 이력 {totalRecords}건 · 총 {formatPrice(totalAmount)}</span>
                </div>
              </div>

              <div className="space-y-5">
                {result.vehicleHistories.map(({ vehicle, records }) => {
                  const byMonth: Record<string, WashRecord[]> = {}
                  records.forEach(r => {
                    const ym = r.wash_date.slice(0, 7)
                    if (!byMonth[ym]) byMonth[ym] = []
                    byMonth[ym].push(r)
                  })
                  return (
                    <div key={vehicle.id} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{vehicle.car_name}</span>
                          <span className="font-mono text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-blue-700">
                            {vehicle.plate_number}
                          </span>
                          {vehicle.customer?.unit_number && (
                            <span className="text-xs text-gray-500">{vehicle.customer.unit_number}</span>
                          )}
                          <span className="text-xs text-blue-600">
                            {CAR_GRADE_LABELS[vehicle.car_grade]} · {MONTHLY_COUNT_LABELS[vehicle.monthly_count]}
                            {vehicle.unit_price && ` · ${formatPrice(vehicle.unit_price)}/회`}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{records.length}건</span>
                      </div>

                      {records.length === 0 && (
                        <div className="px-4 py-4 text-sm text-gray-400 text-center">세차 이력이 없습니다</div>
                      )}

                      {Object.keys(byMonth).length > 0 && (
                        <div className="divide-y divide-gray-100">
                          {Object.entries(byMonth).map(([ym, recs]) => {
                            const [yr, mo] = ym.split('-')
                            const monthTotal = recs.reduce((sum, r) => sum + r.price, 0)
                            return (
                              <div key={ym}>
                                <div className="flex items-center justify-between px-4 py-2 bg-gray-50/50">
                                  <span className="text-xs font-semibold text-gray-600">
                                    {yr}년 {parseInt(mo)}월 — {recs.length}회
                                  </span>
                                  <span className="text-xs font-bold text-blue-700">{formatPrice(monthTotal)}</span>
                                </div>
                                <div className="divide-y divide-gray-50">
                                  {recs.map(r => {
                                    const d = new Date(r.wash_date)
                                    return (
                                      <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-gray-500 w-12">{d.getMonth()+1}/{d.getDate()}</span>
                                          <span className="text-gray-700">
                                            {r.service_type === 'interior_only' ? '실내 전용' : '세차 완료'}
                                          </span>
                                          {r.service_type === 'interior_only' && (
                                            <span className="flex items-center gap-0.5 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">실내전용</span>
                                          )}
                                          {r.service_type === 'interior' && (
                                            <span className="flex items-center gap-0.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                                              <Sofa size={10} />실내
                                            </span>
                                          )}
                                          {r.memo && (
                                            <span className="text-xs text-gray-400 truncate max-w-[120px]">{r.memo}</span>
                                          )}
                                          {r.completed_by === 'admin' && (
                                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">관리자</span>
                                          )}
                                          {r.completed_by === 'worker' && (
                                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">작업자</span>
                                          )}
                                        </div>
                                        <span className="font-medium text-gray-900">{formatPrice(r.price)}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 탭 2: 세금신고 내역 ──────────────────── */}
      {activeTab === 'tax' && (
        <div>
          {/* 월 네비 + 복사 버튼 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <button onClick={() => changeTaxMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
              <span className="text-sm font-semibold text-gray-800 min-w-[80px] text-center">
                {formatYearMonth(taxYearMonth)}
              </span>
              <button onClick={() => changeTaxMonth(1)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <ChevronRight size={20} className="text-gray-600" />
              </button>
            </div>
            <button
              onClick={copyTaxTable}
              disabled={taxRows.length === 0}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                copied
                  ? 'bg-green-100 text-green-700 border-green-300'
                  : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-200'
              }`}
            >
              <Copy size={14} />
              {copied ? '복사됨!' : '스프레드시트 복사'}
            </button>
          </div>

          {/* 요약 */}
          {!taxLoading && taxRows.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex justify-between text-sm">
              <span className="text-gray-600">총 <span className="font-bold text-gray-900">{taxRows.length}건</span></span>
              <span className="font-bold text-blue-700">월공급가액: ₩{taxTotal.toLocaleString()}</span>
            </div>
          )}

          {taxLoading ? (
            <div className="text-center py-12 text-gray-400">불러오는 중...</div>
          ) : taxRows.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">이번 달 세차 기록이 없습니다</div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs border-collapse">
                <colgroup>
                  <col className="w-[130px]" />
                  <col />
                  <col className="w-[80px]" />
                  <col className="w-[80px]" />
                  <col className="w-[40px]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">일자</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">항목/내역</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">공급가액</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-600">증빙종류</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-600">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {taxRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500 tabular-nums whitespace-nowrap">{row.completedAt}</td>
                      <td className="px-3 py-2 text-gray-800">{row.description}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 text-right tabular-nums whitespace-nowrap">
                        {row.price.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-center whitespace-nowrap">
                        {row.paymentMethod ? (PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-center">승인</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td colSpan={2} className="px-3 py-2 font-bold text-blue-800">월 합계</td>
                    <td className="px-3 py-2 font-bold text-blue-700 text-right tabular-nums whitespace-nowrap">
                      {taxTotal.toLocaleString()}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
