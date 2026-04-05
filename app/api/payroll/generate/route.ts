/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  try {
    const supabase = db()
    const { year_month } = await request.json()

    if (!year_month) {
      return NextResponse.json(
        { success: false, message: 'year_month is required' },
        { status: 400 }
      )
    }

    // 해당 월의 모든 세차 기록 조회 (worker별 집계)
    const [year, month] = year_month.split('-')
    const startDate = `${year}-${month}-01`
    
    // 월말 계산
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
    const endDate = `${year}-${month}-${lastDay}`

    // 1. wash_records에서 completed_by(작업자 이름)별 세차 건수 집계
    const { data: washRecords, error: washError } = await supabase
      .from('wash_records')
      .select('completed_by, worker_id')
      .gte('wash_date', startDate)
      .lte('wash_date', endDate)

    if (washError) throw washError

    // completed_by(작업자 이름)별 세차 건수 계산
    const workerWashes: Record<string, number> = {}
    washRecords?.forEach((record: any) => {
      if (record.completed_by && record.completed_by !== 'admin') {
        workerWashes[record.completed_by] = (workerWashes[record.completed_by] || 0) + 1
      }
    })

    // 1-2. workers 테이블에서 워커 정보 조회 (이름 -> UUID 매핑)
    const { data: workers, error: workersError } = await supabase
      .from('workers')
      .select('id, name')

    if (workersError) throw workersError

    const workerMap: Record<string, string> = {}
    workers?.forEach((w: any) => {
      workerMap[w.name] = w.id
    })

    // 2. 기존 정산 레코드 확인
    const { data: existingPayrolls, error: existError } = await supabase
      .from('worker_payrolls')
      .select('id')
      .eq('year_month', year_month)

    if (existError) throw existError

    // 3. 정산 레코드 생성
    const payrollsToCreate: any[] = []
    
    Object.entries(workerWashes).forEach(([workerName, washes]) => {
      const workerId = workerMap[workerName]
      if (workerId) {
        const baseAmount = washes * 10000
        
        payrollsToCreate.push({
          worker_id: workerId,
          year_month,
          total_washes: washes,
          total_amount: baseAmount,
          bonus_amount: 0,
          paid_amount: 0,
          paid_at: null,
          memo: ''
        })
      }
    })

    if (payrollsToCreate.length === 0) {
      return NextResponse.json(
        { success: false, message: '해당 월의 정산할 세차 기록이 없습니다' },
        { status: 400 }
      )
    }

    // 5. 정산 데이터 저장 (기존 데이터 있으면 건너뛰기)
    if (existingPayrolls && existingPayrolls.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `${year_month} 정산 데이터가 이미 존재합니다`
        },
        { status: 400 }
      )
    }

    const { data: createdPayrolls, error: createError } = await supabase
      .from('worker_payrolls')
      .insert(payrollsToCreate)
      .select()

    if (createError) throw createError

    return NextResponse.json({
      success: true,
      message: `${year_month} 정산 데이터 ${createdPayrolls?.length || 0}건 생성`,
      data: createdPayrolls
    })
  } catch (error) {
    console.error('정산 생성 오류:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : '정산 생성 중 오류 발생'
      },
      { status: 500 }
    )
  }
}
