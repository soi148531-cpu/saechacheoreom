import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// PUT: 직원 정보 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, phone, status } = body

    if (!name && !phone && !status) {
      return NextResponse.json(
        { success: false, message: '수정할 정보가 없습니다' },
        { status: 400 }
      )
    }

    const updateData: Record<string, string | null> = {}
    if (name) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (status) updateData.status = status

    const { data, error } = await supabase
      .from('workers')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data, message: '직원 정보가 수정되었습니다' },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { success: false, message: '서버 오류' },
      { status: 500 }
    )
  }
}

// DELETE: 직원 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1단계: 해당 직원이 포함된 wash_records의 worker_id를 NULL로 변경
    await supabase
      .from('wash_records')
      .update({ worker_id: null })
      .eq('worker_id', params.id)

    // 2단계: 직원 삭제
    const { data, error } = await supabase
      .from('workers')
      .delete()
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data, message: '직원이 삭제되었습니다' },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { success: false, message: '서버 오류' },
      { status: 500 }
    )
  }
}
