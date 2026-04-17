import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getNowKSTTimestamp } from '@/lib/utils/timezone'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      vehicle_id,
      schedule_id,
      wash_date,
      price,
      service_type,
      worker_id,
      worked_by,
      completed_by,
      completed_at,
      memo,
    } = body

    // 필수 필드 검증
    if (!vehicle_id || !wash_date || price === undefined || price === null || !worked_by) {
      return NextResponse.json(
        { error: '필수 필드 누락' },
        { status: 400 }
      )
    }

    // ⚠️ schedule_id가 있으면 실제 예약 날짜로 덮어쓰기 (날짜 불일치 방지)
    let finalWashDate = wash_date
    if (schedule_id) {
      const { data: schedule, error: schedError } = await supabase
        .from('schedules')
        .select('scheduled_date')
        .eq('id', schedule_id)
        .single()

      if (schedError) {
        console.warn('스케줄 조회 실패:', schedError.message)
      } else if (schedule && schedule.scheduled_date !== wash_date) {
        console.warn(`⚠️ 날짜 불일치 감지: 클라이언트=${wash_date}, 스케줄=${schedule.scheduled_date} -> 스케줄 기준으로 수정`)
        finalWashDate = schedule.scheduled_date
      }
    }

    // wash_records 테이블에 저장
    const { data, error } = await supabase
      .from('wash_records')
      .insert({
        vehicle_id,
        schedule_id,
        wash_date: finalWashDate, // ✓ 이미 KST 기준의 날짜 (YYYY-MM-DD)
        price,
        service_type: service_type || 'regular',
        worker_id,
        worked_by,
        completed_by,
        is_completed: true,
        completed_at: completed_at || getNowKSTTimestamp(), // ✓ KST 기준 타임스탬프
        memo,
      })
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data,
        message: '세차 완료 처리되었습니다.',
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
