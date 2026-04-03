import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// GET: 직원 목록 조회 (활성만 또는 모두)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    
    let query = supabase
      .from('workers')
      .select('id, name, phone, status', { count: 'exact' })
      .order('name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('status', 'active')
    }

    const { data, error } = await query

    if (error) {
      return Response.json({ success: false, message: error.message }, { status: 500 })
    }

    // 중복 제거 (ID 기준으로)
    const seen = new Set<string>()
    const uniqueData = data.filter(w => {
      if (seen.has(w.id)) {
        return false
      }
      seen.add(w.id)
      return true
    })

    return Response.json({ success: true, data: uniqueData })
  } catch (err) {
    return Response.json(
      { success: false, message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: 새 직원 등록 (관리자 페이지)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, status = 'active' } = body

    if (!name) {
      return NextResponse.json(
        { success: false, message: '이름은 필수입니다' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('workers')
      .insert({
        name: name.trim(),
        phone: phone?.trim() || null,
        status,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data, message: '직원이 등록되었습니다' },
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      { success: false, message: '서버 오류' },
      { status: 500 }
    )
  }
}
