import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function GET() {
  const { data, error } = await supabase
    .from('expense_recurring')
    .select('*, category:expense_categories(id, name)')
    .order('day_of_month', { ascending: true })
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, category_id, amount, day_of_month } = body
  if (!name?.trim()) return Response.json({ success: false, error: '이름을 입력하세요' }, { status: 400 })
  if (!amount || amount <= 0) return Response.json({ success: false, error: '금액을 입력하세요' }, { status: 400 })
  if (!day_of_month || day_of_month < 1 || day_of_month > 31)
    return Response.json({ success: false, error: '날짜(1~31)를 입력하세요' }, { status: 400 })

  const { data, error } = await supabase
    .from('expense_recurring')
    .insert({ name: name.trim(), category_id: category_id || null, amount, day_of_month, is_active: true })
    .select('*, category:expense_categories(id, name)')
    .single()
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true, data }, { status: 201 })
}
