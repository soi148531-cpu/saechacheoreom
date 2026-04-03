/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase/client'

/**
 * GET /api/payroll/[id]/details
 * 정산 상세 정보 및 해당 월의 세차 기록 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = db()
    const { id } = params

    // 1. 정산 데이터 조회
    const { data: payroll, error: payrollError } = await supabase
      .from('worker_payrolls')
      .select('*')
      .eq('id', id)
      .single() as any

    if (payrollError || !payroll) {
      return NextResponse.json(
        { success: false, error: '정산 기록을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 2. 직원 정보 조회
    const { data: worker } = (await supabase
      .from('workers')
      .select('id, name, phone, status')
      .eq('id', (payroll as any).worker_id)
      .single()) as any

    // 3. 해당 월의 세차 기록 조회
    const [year, month] = (payroll as any).year_month.split('-')
    const nextMonth = String(parseInt(month) + 1).padStart(2, '0')
    const nextYear = parseInt(month) === 12 ? String(parseInt(year) + 1) : year

    const { data: washRecords, error: washError } = await supabase
      .from('wash_records')
      .select(
        `id, 
        wash_date, 
        price, 
        service_type,
        vehicle:vehicles(id, vehicle_name, license_plate),
        customer:customers(id, name)`
      )
      .eq('worker_id', (payroll as any).worker_id)
      .eq('worked_by', 'worker')
      .gte('wash_date', `${(payroll as any).year_month}-01`)
      .lt('wash_date', `${nextYear}-${nextMonth}-01`)
      .order('wash_date', { ascending: false })

    if (washError) {
      console.error('세차 기록 조회 에러:', washError)
    }

    // 4. 응답 구성
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detailedWashRecords = (washRecords || []).map((record: any) => ({
      id: record.id,
      date: record.wash_date,
      vehicle_name: record.vehicle?.vehicle_name || 'Unknown',
      license_plate: record.vehicle?.license_plate || 'Unknown',
      customer_name: record.customer?.name || 'Unknown',
      price: record.price,
      service_type: record.service_type
    }))

    return NextResponse.json({
      success: true,
      data: {
        worker: {
          id: (worker as any)?.id,
          name: (worker as any)?.name,
          phone: (worker as any)?.phone,
          status: (worker as any)?.status
        },
        payroll: {
          id: (payroll as any).id,
          year_month: (payroll as any).year_month,
          total_washes: (payroll as any).total_washes,
          total_amount: (payroll as any).total_amount,
          bonus_amount: (payroll as any).bonus_amount,
          paid_amount: (payroll as any).paid_amount,
          paid_at: (payroll as any).paid_at,
          memo: (payroll as any).memo,
          status: (payroll as any).paid_at ? 'paid' : 'unpaid'
        },
        wash_records: detailedWashRecords
      }
    })
  } catch (error) {
    console.error('GET /api/payroll/[id]/details 에러:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
