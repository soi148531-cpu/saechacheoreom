import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const update: Record<string, unknown> = {}
  if (body.date !== undefined) {
    update.date = body.date
    update.year_month = (body.date as string).substring(0, 7)
  }
  if (body.category_id !== undefined) update.category_id = body.category_id || null
  if (body.amount !== undefined) update.amount = body.amount
  if (body.memo !== undefined) update.memo = body.memo || null

  const { data, error } = await supabase
    .from('expenses')
    .update(update)
    .eq('id', params.id)
    .select('*, category:expense_categories(id, name), recurring:expense_recurring(id, name)')
    .single()
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true, data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', params.id)
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
