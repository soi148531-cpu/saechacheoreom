import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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
      completed_at,
      memo,
    } = body

    // 필수 필드 검증
    if (!vehicle_id || !wash_date || !price || !worked_by) {
      return NextResponse.json(
        { error: '필수 필드 누락' },
        { status: 400 }
      )
    }

    // wash_records 테이블에 저장
    const { data, error } = await supabase
      .from('wash_records')
      .insert({
        vehicle_id,
        schedule_id,
        wash_date,
        price,
        service_type: service_type || 'regular',
        worker_id,
        worked_by,
        completed_at: completed_at || new Date().toISOString(),
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
