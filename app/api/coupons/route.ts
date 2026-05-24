import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = 'https://zzeyflxnmolfoqrvlxwc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZXlmbHhubW9sZm9xcnZseHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc2ODIsImV4cCI6MjA5MDMzMzY4Mn0.CKDa59JyhsyjF232I2S5uKrQ5sbvBFFx4y3hr7id7I8'

function db() { return createClient(SUPABASE_URL, SUPABASE_ANON_KEY) as any }

// GET ?customer_id=xxx → 해당 고객의 쿠폰 목록 반환
// 각 배치별로 total_issued, used_count, remaining(=total_issued-used_count) 반환
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const customer_id = searchParams.get('customer_id')
  if (!customer_id) return NextResponse.json({ success: false, message: 'customer_id required' }, { status: 400 })

  const { data, error } = await db()
    .from('customer_coupons')
    .select('*')
    .eq('customer_id', customer_id)
    .order('issued_at', { ascending: false })

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data || [] })
}

// POST body: { customer_id, total_issued, note } → 쿠폰 발행
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { customer_id, total_issued, note } = body
  if (!customer_id || !total_issued || total_issued < 1) {
    return NextResponse.json({ success: false, message: '유효하지 않은 입력' }, { status: 400 })
  }
  const { data, error } = await db()
    .from('customer_coupons')
    .insert({ customer_id, total_issued, used_count: 0, coupon_type: 'interior', note: note || null })
    .select().single()
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}
