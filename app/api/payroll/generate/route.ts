/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as _createClient } from '@supabase/supabase-js'
import { WORKER_BASE_RATE, WORKER_RATES } from '@/lib/constants/pricing'
import { getNowKSTTimestamp } from '@/lib/utils/timezone'

// 함수 번들 캐싱 문제 방지: 직접 클라이언트 생성
const SUPABASE_URL = 'https://zzeyflxnmolfoqrvlxwc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZXlmbHhubW9sZm9xcnZseHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc2ODIsImV4cCI6MjA5MDMzMzY4Mn0.CKDa59JyhsyjF232I2S5uKrQ5sbvBFFx4y3hr7id7I8'

function localDb(): any {
  return _createClient(SUPABASE_URL, SUPABASE_ANON_KEY) as any
}

/**
 * 현재 설정된 작업자 단가를 조회합니다
 */
async function getWorkerRates(supabase: any) {
  try {
    const { data, error } = await supabase
      .from('worker_rate_settings')
      .select('outdoor_rate, indoor_rate')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.warn('단가 설정 조회 에러:', error.message)
    }

    // 설정이 있으면 DB값 사용, 없으면 상수값 사용
    if (data) {
      return {
        outdoor: data.outdoor_rate || WORKER_RATES.OUTDOOR || WORKER_BASE_RATE,
        indoor: data.indoor_rate || WORKER_RATES.INDOOR || WORKER_BASE_RATE
      }
    }

    return {
      outdoor: WORKER_RATES.OUTDOOR || WORKER_BASE_RATE,
      indoor: WORKER_RATES.INDOOR || WORKER_BASE_RATE
    }
  } catch (error) {
    console.warn('단가 조회 중 에러 발생, 기본값 사용:', error)
    return {
      outdoor: WORKER_RATES.OUTDOOR || WORKER_BASE_RATE,
      indoor: WORKER_RATES.INDOOR || WORKER_BASE_RATE
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = localDb()
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

    // 1. 현재 설정된 단가 조회
    const rates = await getWorkerRates(supabase)
    console.log('📊 적용 단가:', rates)

    // 2. wash_records에서 completed_by(작업자 이름)별 세차 건수 집계 (service_type 포함)
    // ⚠️ completed_by가 NULL인 비정상 기록은 제외
    const { data: washRecords, error: washError } = await supabase
      .from('wash_records')
      .select('id, completed_by, worker_id, service_type, wash_date, vehicle_id, created_at')
      .gte('wash_date', startDate)
      .lte('wash_date', endDate)
      .not('completed_by', 'is', null)  // completed_by가 NULL인 비정상 기록 제외

    if (washError) throw washError

    // 중복 제거: 같은 날 같은 차량 같은 worker에서 가장 오래된 기록만 유지
    const uniqueRecords: any[] = []
    const seen = new Set<string>()
    
    const sorted = (washRecords || []).sort((a: any, b: any) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    
    sorted.forEach((record: any) => {
      const key = `${record.wash_date}|${record.vehicle_id}|${record.completed_by}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueRecords.push(record)
      }
    })

    console.log(`📊 원본 기록: ${washRecords?.length || 0}건, 중복 제거 후: ${uniqueRecords.length}건`)

    // completed_by(작업자 이름)별로 outdoor/indoor 세차 건수 계산
    // ✅ 세차 1건 = 항상 실외 1건 포함. 실내청소가 있으면 실내도 1건 추가
    const workerCount: Record<string, { total: number; outdoor: number; indoor: number; worker_id?: string }> = {}
    uniqueRecords?.forEach((record: any) => {
      if (record.completed_by && record.completed_by !== 'admin') {
        if (!workerCount[record.completed_by]) {
          workerCount[record.completed_by] = { total: 0, outdoor: 0, indoor: 0, worker_id: record.worker_id }
        }
        
        // 세차 1건 = 실외 1건 (항상)
        workerCount[record.completed_by].total += 1
        workerCount[record.completed_by].outdoor += 1
        // 실내청소가 포함된 경우 실내도 추가
        if (record.service_type && record.service_type.includes('interior')) {
          workerCount[record.completed_by].indoor += 1
        }
      }
    })

    // 2-2. workers 테이블에서 워커 정보 조회 (이름 -> UUID 매핑)
    const { data: workers, error: workersError } = await supabase
      .from('workers')
      .select('id, name')

    if (workersError) throw workersError

    const workerMap: Record<string, string> = {}
    workers?.forEach((w: any) => {
      workerMap[w.name] = w.id
    })

    // 3. 기존 정산 레코드 확인
    const { data: existingPayrolls, error: existError } = await supabase
      .from('worker_payrolls')
      .select('id')
      .eq('year_month', year_month)

    if (existError) throw existError

    // 4. 정산 레코드 생성
    const payrollsToCreate: any[] = []
    
    Object.entries(workerCount).forEach(([workerName, counts]) => {
      const workerId = workerMap[workerName]
      if (workerId) {
        // 계산: (실외 × 외부료금) + (실내 × 내부료금)
        const outdoorAmount = counts.outdoor * rates.outdoor
        const indoorAmount = counts.indoor * rates.indoor
        const baseAmount = outdoorAmount + indoorAmount
        
        payrollsToCreate.push({
          worker_id: workerId,
          year_month,
          total_washes: counts.total,  // 실제 세차 차량 대수 (실내/실외 중복 아님)
          total_amount: baseAmount,  // 기본 정산액 (실외 + 실내)
          bonus_amount: 0,  // 기타금액 (초기값)
          paid_amount: baseAmount,  // 지급 예정액
          paid_at: null,
          created_at: getNowKSTTimestamp(),  // ✓ KST 기준 타임스탬프
          memo: `(실외 ${counts.outdoor}건 × ₩${rates.outdoor.toLocaleString()} + 실내 ${counts.indoor}건 × ₩${rates.indoor.toLocaleString()})`
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
