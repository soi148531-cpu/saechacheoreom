/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase/client'

/**
 * GET /api/payroll?year_month=2026-04
 * 월별 정산 데이터 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = db()
    const { searchParams } = new URL(request.url)
    const yearMonth = searchParams.get('year_month')

    if (!yearMonth) {
      return NextResponse.json(
        { success: false, error: 'year_month 파라미터가 필요합니다 (예: 2026-04)' },
        { status: 400 }
      )
    }

    // 정산 데이터 조회
    const { data: payrolls, error: payrollError } = await supabase
      .from('worker_payrolls')
      .select('*')
      .eq('year_month', yearMonth)
      .order('created_at', { ascending: true })

    if (payrollError) {
      return NextResponse.json(
        { success: false, error: payrollError.message },
        { status: 500 }
      )
    }

    // 직원 정보 추가
    if (!payrolls || payrolls.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          total_workers: 0,
          total_washes: 0,
          total_payroll: 0,
          unpaid_count: 0,
          paid_count: 0
        }
      })
    }

    // 직원 정보 병합 및 status 계산
    const enrichedPayrolls = await Promise.all(
      payrolls.map(async (payroll: any) => {
        const { data: worker } = (await supabase
          .from('workers')
          .select('name, phone')
          .eq('id', payroll.worker_id)
          .single()) as any

        return {
          ...payroll,
          worker_name: (worker as any)?.name || 'Unknown',
          status: payroll.paid_at ? 'paid' : 'unpaid'
        }
      })
    )

    // 요약 정보 계산
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = {
      total_workers: enrichedPayrolls.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      total_washes: enrichedPayrolls.reduce((sum, p: any) => sum + (p.total_washes || 0), 0),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      total_payroll: enrichedPayrolls.reduce((sum, p: any) => sum + (p.paid_amount || 0), 0),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unpaid_count: enrichedPayrolls.filter((p: any) => !p.paid_at).length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      paid_count: enrichedPayrolls.filter((p: any) => p.paid_at).length
    }

    return NextResponse.json({
      success: true,
      data: enrichedPayrolls,
      summary
    })
  } catch (error) {
    console.error('GET /api/payroll 에러:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/payroll/generate
 * 월별 정산 데이터 자동 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year_month } = body

    if (!year_month) {
      return NextResponse.json(
        { success: false, error: 'year_month이 필요합니다 (예: 2026-04)' },
        { status: 400 }
      )
    }

    const supabase = db()

    // 1. 활성 직원 목록 조회
    const { data: workers, error: workerError } = await supabase
      .from('workers')
      .select('id, name')
      .eq('status', 'active')

    if (workerError) {
      return NextResponse.json(
        { success: false, error: workerError.message },
        { status: 500 }
      )
    }

    if (!workers || workers.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: '활성 직원이 없습니다'
      })
    }

    const [year, month] = year_month.split('-')

    // 2. 각 직원별로 해당 월의 세차 기록 집계
    const generatedPayrolls = []

    for (const worker of workers) {
      // 해당 월의 세차 기록 조회
      const { data: washRecords, error: washError } = await supabase
        .from('wash_records')
        .select('id, price')
        .eq('worker_id', worker.id)
        .eq('worked_by', 'worker')
        .gte('wash_date', `${year_month}-01`)
        .lt('wash_date', `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`)

      if (washError) {
        console.error(`직원 ${worker.id}의 세차기록 조회 실패:`, washError)
        continue
      }

      const total_washes = washRecords?.length || 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const total_amount = washRecords?.reduce((sum: number, r: any) => sum + (r.price || 0), 0) || 0

      // 이미 존재하는 정산 데이터 확인
      const { data: existing } = await supabase
        .from('worker_payrolls')
        .select('id')
        .eq('worker_id', worker.id)
        .eq('year_month', year_month)
        .single()

      if (existing) {
        // 기존 데이터 업데이트 (세차건수와 금액만)
        const { data: updated, error: updateError } = await supabase
          .from('worker_payrolls')
          .update({
            total_washes,
            total_amount,
            paid_amount: total_amount // basic amount (bonus는 유지)
          })
          .eq('id', existing.id)
          .select()

        if (!updateError && updated) {
          generatedPayrolls.push(updated[0])
        }
      } else {
        // 새로운 정산 데이터 생성
        const { data: created, error: insertError } = await supabase
          .from('worker_payrolls')
          .insert({
            worker_id: worker.id,
            year_month,
            total_washes,
            total_amount,
            bonus_amount: 0,
            paid_amount: total_amount,
            paid_at: null,
            memo: ''
          })
          .select()

        if (!insertError && created) {
          generatedPayrolls.push(created[0])
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: generatedPayrolls,
      message: `${year_month} 정산 데이터가 생성/업데이트되었습니다 (${generatedPayrolls.length}명)`
    })
  } catch (error) {
    console.error('POST /api/payroll/generate 에러:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
