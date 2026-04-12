/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase/client'

/**
 * PUT /api/payroll/[id]
 * 정산 데이터 업데이트 (지급처리, 보너스 수정 등)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = db()
    const { id } = params
    const body = await request.json()

    // paid_at, memo, bonus_amount, paid_amount 중 필요한 것만 업데이트
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    if (body.paid_at !== undefined) {
      updateData.paid_at = body.paid_at
    }
    if (body.memo !== undefined) {
      updateData.memo = body.memo
    }
    if (body.bonus_amount !== undefined) {
      updateData.bonus_amount = body.bonus_amount
      
      // bonus_amount가 변경되면 paid_amount도 재계산
      const { data: payroll } = (await supabase
        .from('worker_payrolls')
        .select('total_amount')
        .eq('id', id)
        .single()) as any

      if (payroll) {
        updateData.paid_amount = (payroll as any).total_amount + body.bonus_amount
      }
    }
    if (body.paid_amount !== undefined) {
      updateData.paid_amount = body.paid_amount
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '업데이트할 필드가 없습니다' },
        { status: 400 }
      )
    }

    // 업데이트 실행
    const { data: updated, error: updateError } = (await supabase
      .from('worker_payrolls')
      .update(updateData)
      .eq('id', id)
      .select()) as any

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { success: false, error: '정산 기록을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 직원 정보 추가
    const payroll = (updated as any)[0]
    const { data: worker } = (await supabase
      .from('workers')
      .select('name')
      .eq('id', (payroll as any).worker_id)
      .single()) as any

    return NextResponse.json({
      success: true,
      data: {
        ...(payroll as any),
        worker_name: (worker as any)?.name || 'Unknown',
        status: (payroll as any).paid_at ? 'paid' : 'unpaid'
      },
      message: '정산이 처리되었습니다'
    })
  } catch (error) {
    console.error('PUT /api/payroll/[id] 에러:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/payroll/[id]
 * 정산 기록 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = db()
    const { id } = params

    // 정산 기록 삭제
    const { error: deleteError } = await supabase
      .from('worker_payrolls')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('❌ 정산 삭제 실패:', deleteError)
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      )
    }

    console.log('✅ 정산 기록 삭제 성공:', id)
    return NextResponse.json({
      success: true,
      message: '정산 기록이 삭제되었습니다'
    })
  } catch (error) {
    console.error('DELETE /api/payroll/[id] 에러:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
