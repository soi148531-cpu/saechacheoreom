/* eslint-disable @typescript-eslint/no-explicit-any */
/* V5: REST API ONLY - No Supabase Client Library */
import { NextRequest, NextResponse } from 'next/server'

const URL = 'https://zzeyflxnmolfoqrvlxwc.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZXlmbHhubW9sZm9xcnZseHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc2ODIsImV4cCI6MjA5MDMzMzY4Mn0.CKDa59JyhsyjF232I2S5uKrQ5sbvBFFx4y3hr7id7I8'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const headers = { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    
    // 1. Get payroll by id
    const pResp = await fetch(`${URL}/rest/v1/worker_payrolls?id=eq.${id}`, { headers })
    const payrolls = await pResp.json()
    if (!payrolls || !payrolls[0]) return NextResponse.json({ error: 'Payroll not found' }, { status: 404 })
    const payroll = payrolls[0]
    
    // 2. Get worker info
    const wResp = await fetch(`${URL}/rest/v1/workers?id=eq.${payroll.worker_id}`, { headers })
    const workers = await wResp.json()
    const worker = workers?.[0]
    const workerName = worker?.name
    
    // 3. Get wash records for this worker and period
    const [year, month] = payroll.year_month.split('-')
    const nextMonth = String(parseInt(month) + 1).padStart(2, '0')
    const nextYear = month === '12' ? String(parseInt(year) + 1) : year
    
    // Use raw REST API URL with filters
    const wrUrl = `${URL}/rest/v1/wash_records?select=id,wash_date,service_type,vehicle_id,created_at&completed_by=eq.${encodeURIComponent(workerName)}&wash_date=gte.${year}-${month}-01&wash_date=lt.${nextYear}-${nextMonth}-01&order=created_at.desc`
    const wrResp = await fetch(wrUrl, { headers })
    const washRecords = await wrResp.json()
    
    // 4. Deduplicate (keep latest per date+vehicle)
    const deduped = new Map()
    washRecords?.forEach((r: any) => {
      const key = `${r.wash_date}|${r.vehicle_id}`
      if (!deduped.has(key) || new Date(r.created_at) > new Date(deduped.get(key).created_at)) {
        deduped.set(key, r)
      }
    })
    const dedupedArray = Array.from(deduped.values())
    
    // 5. Get vehicle details
    if (dedupedArray.length === 0) {
      return NextResponse.json({
        success: true,
        _version: 'v5-rest-api',
        data: {
          worker: { id: worker?.id, name: worker?.name },
          payroll: {
            id: payroll.id,
            year_month: payroll.year_month,
            total_washes: 0,
            outdoor_wash_count: 0,
            indoor_wash_count: 0,
            total_amount: 0,
          },
          wash_records: []
        }
      })
    }
    
    const vehicleIds = Array.from(new Set(dedupedArray.map((r: any) => r.vehicle_id)))
    const vResp = await fetch(`${URL}/rest/v1/vehicles?select=id,car_name,plate_number&id=in.(${vehicleIds.join(',')})`, { headers })
    const vehicles = await vResp.json()
    const vehicleMap: Map<string, any> = new Map(vehicles?.map((v: any) => [v.id, v]) || [])
    
    // 6. Format response
    const detailed = dedupedArray.map((r: any) => ({
      id: r.id,
      date: r.wash_date,
      carName: vehicleMap.get(r.vehicle_id)?.car_name || 'Unknown',
      plateNumber: vehicleMap.get(r.vehicle_id)?.plate_number || 'Unknown',
      hasInteriorCleaning: r.service_type?.includes('interior'),
      serviceType: r.service_type
    }))
    
    const outdoor = detailed.length
    const indoor = detailed.filter((r: any) => r.hasInteriorCleaning).length
    
    return NextResponse.json({
      success: true,
      _version: 'v5-rest-api',
      data: {
        worker: { id: worker?.id, name: worker?.name, phone: worker?.phone },
        payroll: {
          id: payroll.id,
          year_month: payroll.year_month,
          total_washes: payroll.total_washes,
          outdoor_wash_count: outdoor,
          indoor_wash_count: indoor,
          total_amount: payroll.total_amount,
          bonus_amount: payroll.bonus_amount || 0,
          paid_amount: payroll.paid_amount || payroll.total_amount,
          memo: payroll.memo
        },
        wash_records: detailed
      }
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) })
  }
}
