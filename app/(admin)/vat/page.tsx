'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import type { WashRecord, Vehicle, Customer } from '@/types'

type VatRow = WashRecord & {
  vehicle: Vehicle & { customer: Customer }
}

function padMonth(n: number) { return String(n + 1).padStart(2, '0') }

const MONTHS_KR = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

export default function VatPage() {
  const supabase = createClient()
  const today = new Date()

  const [year,    setYear]    = useState(today.getFullYear())
  const [month,   setMonth]   = useState(today.getMonth())
  const [records, setRecords] = useState<VatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)

  const ymPrefix = `${year}-${padMonth(month)}`

  const fetchData = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb
      .from('wash_records')
      .select('*, vehicle:vehicles(*, customer:customers(*))')
      .gte('wash_date', `${ymPrefix}-01`)
      .lte('wash_date', `${ymPrefix}-31`)
      .eq('is_completed', true)
      .order('wash_date', { ascending: true })
    if (data) setRecords(data as VatRow[])
    setLoading(false)
  }, [ymPrefix])

  useEffect(() => { fetchData() }, [fetchData])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const totalSupply = records.reduce((s, r) => s + r.price, 0)

  function getDescription(r: VatRow) {
    const customer = r.vehicle?.customer
    const v = r.vehicle
    const name = customer?.name ?? '-'
    const plate = v?.plate_number ?? '-'
    const unit = v?.unit_number ? `(${v.unit_number}호)` : ''
    const type = r.service_type === 'interior' ? '실내세차' : '세차 서비스'
    return `새차처럼 ${type} - ${name}${unit} ${plate}`
  }

  function buildTsv() {
    const header = ['일자', '항목/내역', '', '', '공급대가(원)', '증빙종류', '비고'].join('\t')
    const rows = records.map(r => {
      const desc = getDescription(r)
      // A: 일자, B: 항목/내역, C: (병합), D: (병합), E: 공급대가, F: 증빙종류, G: 비고
      return [r.wash_date, desc, '', '', String(r.price), '간이영수증', r.memo ?? ''].join('\t')
    })
    // 헤더 포함 (스프레드시트에 A1부터 붙여넣기)
    return [header, ...rows].join('\n')
  }

  async function copyToClipboard() {
    const tsv = buildTsv()
    try {
      await navigator.clipboard.writeText(tsv)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = tsv
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">부가세 신고자료</h1>
          <p className="text-xs text-gray-400 mt-0.5">완료된 세차 내역을 구글 스프레드시트에 붙여넣기</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-gray-800 min-w-[90px] text-center">
            {year}년 {MONTHS_KR[month]}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 월공급대가 요약 (스프레드시트 노란 셀 참고) */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-yellow-700 font-semibold">월공급대가</p>
          <p className="text-2xl font-bold text-yellow-900">{formatPrice(totalSupply)}</p>
          <p className="text-xs text-yellow-600 mt-0.5">총 {records.length}건</p>
        </div>
        <button
          onClick={copyToClipboard}
          disabled={records.length === 0}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
            copied
              ? 'bg-green-500 text-white'
              : records.length === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? '복사 완료!' : '클립보드 복사'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">데이터 불러오는 중...</div>
      ) : records.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">이 달의 완료된 세차 내역이 없습니다.</div>
      ) : (
        <>
          {/* 스프레드시트 미리보기 테이블 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* 스프레드시트 컬럼 헤더 */}
            <div className="grid grid-cols-[90px_1fr_100px_100px_80px] bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 px-3 py-2 gap-2">
              <span>일자 [A]</span>
              <span>항목/내역 [B]</span>
              <span>공급대가(원) [E]</span>
              <span>증빙종류 [F]</span>
              <span>비고 [G]</span>
            </div>
            <div className="divide-y divide-gray-100">
              {records.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[90px_1fr_100px_100px_80px] px-3 py-2.5 gap-2 text-sm hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-600 font-mono text-xs">{r.wash_date}</span>
                  <span className="text-gray-800 leading-tight">{getDescription(r)}</span>
                  <span className="text-right text-gray-800 font-medium font-mono">{formatPrice(r.price)}</span>
                  <span className="text-gray-500 text-xs">간이영수증</span>
                  <span className="text-gray-400 text-xs truncate">{r.memo ?? ''}</span>
                </div>
              ))}
            </div>
            {/* 합계 행 */}
            <div className="grid grid-cols-[90px_1fr_100px_100px_80px] px-3 py-2.5 gap-2 bg-yellow-50 border-t border-yellow-200">
              <span className="col-span-2 text-xs font-bold text-yellow-800">합계</span>
              <span className="text-right font-bold text-yellow-900 font-mono">{formatPrice(totalSupply)}</span>
              <span></span>
              <span></span>
            </div>
          </div>

          {/* 붙여넣기 안내 */}
          <div className="mt-3 bg-blue-50 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
            <p className="font-semibold mb-1">📋 구글 스프레드시트 붙여넣기 방법</p>
            <p>1. <strong>클립보드 복사</strong> 버튼 클릭</p>
            <p>2. 스프레드시트에서 <strong>월별 시트</strong> → <strong>A2 셀</strong> 선택</p>
            <p>3. <kbd className="bg-blue-100 px-1 rounded">Ctrl+Shift+V</kbd> (서식 없이 붙여넣기)</p>
            <p className="mt-1 text-blue-500">데이터는 일자, 항목/내역, 공급대가, 증빙종류, 비고 순서로 복사됩니다.</p>
          </div>
        </>
      )}
    </div>
  )
}