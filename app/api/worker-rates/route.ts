/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase/client'

/**
 * GET /api/worker-rates
 * 현재 작업자 단가 설정 조회
 */
export async function GET() {
  try {
    const supabase = db()

    const { data, error } = await supabase
      .from('worker_rate_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116: 결과 없음 (허용된 에러)
      throw error
    }

    if (!data) {
      // 기본값 반환
      return NextResponse.json({
        success: true,
        data: {
          outdoor_rate: 10000,
          indoor_rate: 10000,
          updated_at: new Date().toISOString()
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        outdoor_rate: data.outdoor_rate,
        indoor_rate: data.indoor_rate,
        updated_by: data.updated_by,
        updated_at: data.updated_at,
        notes: data.notes
      }
    })
  } catch (error) {
    console.error('GET /api/worker-rates 에러:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '단가 정보 조회 실패' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/worker-rates
 * 작업자 단가 설정 변경
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = db()
    const { outdoor_rate, indoor_rate, notes } = await request.json()

    // 입력값 검증
    if (typeof outdoor_rate !== 'number' || outdoor_rate < 0) {
      return NextResponse.json(
        { success: false, error: 'outdoor_rate는 0 이상의 숫자여야 합니다' },
        { status: 400 }
      )
    }

    if (typeof indoor_rate !== 'number' || indoor_rate < 0) {
      return NextResponse.json(
        { success: false, error: 'indoor_rate는 0 이상의 숫자여야 합니다' },
        { status: 400 }
      )
    }

    // 기존 설정 조회
    const { data: existing } = await supabase
      .from('worker_rate_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let result

    if (existing) {
      // 기존 레코드 업데이트
      const { data, error } = await supabase
        .from('worker_rate_settings')
        .update({
          outdoor_rate,
          indoor_rate,
          updated_by: 'admin',
          updated_at: new Date().toISOString(),
          notes: notes || `단가 설정 변경: 실외 ₩${outdoor_rate}, 실내 ₩${indoor_rate}`
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      result = data
    } else {
      // 새 레코드 생성
      const { data, error } = await supabase
        .from('worker_rate_settings')
        .insert([{
          outdoor_rate,
          indoor_rate,
          updated_by: 'admin',
          updated_at: new Date().toISOString(),
          notes: notes || `단가 설정 생성: 실외 ₩${outdoor_rate}, 실내 ₩${indoor_rate}`
        }])
        .select()
        .single()

      if (error) throw error
      result = data
    }

    console.log('✅ 단가 설정 저장 성공:', {
      outdoor_rate: result.outdoor_rate,
      indoor_rate: result.indoor_rate,
      updated_at: result.updated_at
    })

    return NextResponse.json({
      success: true,
      message: '단가 설정이 업데이트되었습니다',
      data: {
        id: result.id,
        outdoor_rate: result.outdoor_rate,
        indoor_rate: result.indoor_rate,
        updated_by: result.updated_by,
        updated_at: result.updated_at,
        notes: result.notes
      }
    })
  } catch (error) {
    console.error('❌ PUT /api/worker-rates 에러:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '단가 설정 변경 실패' },
      { status: 500 }
    )
  }
}
