import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const yearMonth = searchParams.get('year_month')
  if (!yearMonth) return Response.json({ success: false, error: 'year_month 파라미터가 필요합니다' }, { status: 400 })

  // 이번달이면 고정지출 자동 생성
  const today = new Date()
  const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  if (yearMonth === currentYearMonth) {
    const todayDay = today.getDate()
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

    const { data: recurringItems } = await supabase
      .from('expense_recurring')
      .select('*')
      .eq('is_active', true)
      .lte('day_of_month', todayDay)

    if (recurringItems && recurringItems.length > 0) {
      const { data: existing } = await supabase
        .from('expenses')
        .select('recurring_id')
        .eq('year_month', yearMonth)
        .eq('is_recurring', true)
        .not('recurring_id', 'is', null)

      const existingIds = new Set((existing ?? []).map((e: { recurring_id: string }) => e.recurring_id))
      const toCreate = recurringItems
        .filter(r => !existingIds.has(r.id))
        .map(r => {
          const day = Math.min(r.day_of_month, lastDayOfMonth)
          return {
            year_month: yearMonth,
            date: `${yearMonth}-${String(day).padStart(2, '0')}`,
            category_id: r.category_id,
            amount: r.amount,
            memo: null,
            is_recurring: true,
            recurring_id: r.id,
          }
        })

      if (toCreate.length > 0) {
        await supabase.from('expenses').insert(toCreate)
      }
    }
  }

  const { data, error } = await supabase
    .from('expenses')
    .select('*, category:expense_categories(id, name)')
    .eq('year_month', yearMonth)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })

  const total = (data ?? []).reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)
  return Response.json({ success: true, data, total })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { date, category_id, amount, memo } = body
  if (!date) return Response.json({ success: false, error: '날짜를 입력하세요' }, { status: 400 })
  if (!amount || amount <= 0) return Response.json({ success: false, error: '금액을 입력하세요' }, { status: 400 })

  const year_month = (date as string).substring(0, 7)

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      year_month,
      date,
      category_id: category_id || null,
      amount,
      memo: memo || null,
      is_recurring: false,
      recurring_id: null,
    })
    .select('*, category:expense_categories(id, name)')
    .single()

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true, data }, { status: 201 })
}
