import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { name } = await request.json()
  if (!name?.trim()) return Response.json({ success: false, error: '카테고리 이름을 입력하세요' }, { status: 400 })
  const { data, error } = await supabase
    .from('expense_categories')
    .update({ name: name.trim() })
    .eq('id', params.id)
    .select()
    .single()
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true, data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabase
    .from('expense_categories')
    .delete()
    .eq('id', params.id)
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
