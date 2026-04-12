/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

/**
 * GET /api/payroll/salary-ledger/[year_month]
 * 급여부(급여대장) 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { year_month: string } }
) {
  try {
    const year_month = params.year_month

    if (!year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
      return NextResponse.json(
        { success: false, error: 'Invalid year_month format (YYYY-MM required)' },
        { status: 400 }
      )
    }

    const supabase = db()

    // 해당 월의 정산 데이터 조회 (모든 직원)
    const { data: payrolls, error } = await supabase
      .from('worker_payrolls')
      .select(`
        id,
        worker_id,
        total_washes,
        total_amount,
        bonus_amount,
        paid_amount,
        paid_at,
        memo,
        workers(id, name, phone)
      `)
      .eq('year_month', year_month)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Salary ledger error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // 데이터 정형화
    const ledger = (payrolls as any[]).map((p: any, idx: number) => ({
      순번: idx + 1,
      이름: p.workers?.name || 'Unknown',
      전화: p.workers?.phone || '-',
      세차건수: p.total_washes,
      기본급여: p.total_amount,
      추가금액: p.bonus_amount,
      최종지급액: p.paid_amount,
      지급여부: p.paid_at ? '지급' : '미지급',
      지급일자: p.paid_at ? new Date(p.paid_at).toLocaleDateString('ko-KR') : '-',
      지급방법: p.memo || '-'
    }))

    // 합계 계산
    const summary = {
      총직원수: ledger.length,
      총세차건수: ledger.reduce((sum: number, r: any) => sum + r.세차건수, 0),
      총기본급여: ledger.reduce((sum: number, r: any) => sum + r.기본급여, 0),
      총추가금액: ledger.reduce((sum: number, r: any) => sum + r.추가금액, 0),
      총지급액: ledger.reduce((sum: number, r: any) => sum + r.최종지급액, 0),
      지급완료: ledger.filter((r: any) => r.지급여부 === '지급').length,
      미지급: ledger.filter((r: any) => r.지급여부 === '미지급').length
    }

    return NextResponse.json({
      success: true,
      data: {
        year_month,
        company_name: '새차처럼',
        created_at: new Date().toISOString(),
        ledger,
        summary
      }
    })
  } catch (error) {
    console.error('Salary ledger exception:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
