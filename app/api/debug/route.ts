import { NextResponse } from 'next/server'

const SUPABASE_URL = 'https://zzeyflxnmolfoqrvlxwc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZXlmbHhubW9sZm9xcnZseHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc2ODIsImV4cCI6MjA5MDMzMzY4Mn0.CKDa59JyhsyjF232I2S5uKrQ5sbvBFFx4y3hr7id7I8'

export async function GET() {
  // 1. Raw fetch - all wash_records
  const allResp = await fetch(
    `${SUPABASE_URL}/rest/v1/wash_records?select=id,wash_date,completed_by,service_type&order=wash_date.desc`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'count=exact'
      }
    }
  )
  const allData = await allResp.json()
  const totalCount = allResp.headers.get('content-range')

  // 2. Raw fetch - filtered by completed_by=황영훈 and April 2026
  const filteredResp = await fetch(
    `${SUPABASE_URL}/rest/v1/wash_records?select=id,wash_date,completed_by,service_type,vehicle_id&completed_by=eq.황영훈&wash_date=gte.2026-04-01&wash_date=lt.2026-05-01&order=wash_date.desc`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    }
  )
  const filteredData = await filteredResp.json()

  return NextResponse.json({
    version: 'debug-v3-raw-fetch',
    totalCount,
    allDataCount: allData?.length,
    allData,
    filteredDataCount: filteredData?.length,
    filteredData,
  })
}
