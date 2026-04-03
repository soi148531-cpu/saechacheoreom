/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

/**
 * PUT /api/payroll/batch-pay
 * 일괄 지급 처리
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { payroll_ids, memo } = body

    if (!Array.isArray(payroll_ids) || payroll_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'payroll_ids must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!memo) {
      return NextResponse.json(
        { success: false, error: 'memo is required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const supabase = db()

    // Update all payrolls with paid_at timestamp
    const { data, error } = await supabase
      .from('worker_payrolls')
      .update({
        paid_at: now,
        memo: memo,
        updated_at: now,
      })
      .in('id', payroll_ids)
      .select()

    if (error) {
      console.error('Batch pay error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Calculate summary
    const totalAmount = (data as any[])?.reduce(
      (sum: number, p: any) => sum + (p.paid_amount || 0),
      0
    ) || 0

    return NextResponse.json({
      success: true,
      data: data,
      summary: {
        count: data?.length || 0,
        total_amount: totalAmount,
        paid_at: now,
        memo: memo,
      },
    })
  } catch (error) {
    console.error('Batch pay exception:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
