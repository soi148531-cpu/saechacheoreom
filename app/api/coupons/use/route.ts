import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = 'https://zzeyflxnmolfoqrvlxwc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZXlmbHhubW9sZm9xcnZseHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc2ODIsImV4cCI6MjA5MDMzMzY4Mn0.CKDa59JyhsyjF232I2S5uKrQ5sbvBFFx4y3hr7id7I8'

function db() { return createClient(SUPABASE_URL, SUPABASE_ANON_KEY) as any }

// POST body: { customer_id } → 가장 오래된 배치에서 쿠폰 1장 사용
export async function POST(request: NextRequest) {
  const { customer_id } = await request.json()
  if (!customer_id) return NextResponse.json({ success: false, message: 'customer_id required' }, { status: 400 })

  // 잔여 쿠폰이 있는 배치 중 가장 오래된 것 조회
  const { data: batches, error: fetchError } = await db()
    .from('customer_coupons')
    .select('*')
    .eq('customer_id', customer_id)
    .order('issued_at', { ascending: true })

  if (fetchError) return NextResponse.json({ success: false, message: fetchError.message }, { status: 500 })

  const available = (batches || []).find((b: any) => b.used_count < b.total_issued)
  if (!available) return NextResponse.json({ success: false, message: '사용 가능한 쿠폰이 없습니다' }, { status: 400 })

  const newUsed = available.used_count + 1
  const { error: updateError } = await db()
    .from('customer_coupons')
    .update({ used_count: newUsed })
    .eq('id', available.id)

  if (updateError) return NextResponse.json({ success: false, message: updateError.message }, { status: 500 })

  // 전체 잔여 쿠폰 수 계산
  const totalRemaining = (batches || []).reduce((sum: number, b: any) => {
    if (b.id === available.id) return sum + (b.total_issued - newUsed)
    return sum + Math.max(0, b.total_issued - b.used_count)
  }, 0)

  return NextResponse.json({ success: true, remaining: totalRemaining })
}
