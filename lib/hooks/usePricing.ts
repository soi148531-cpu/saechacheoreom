import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  MONTHLY_PRICE_TABLE,
  ONETIME_PRICE_TABLE,
  INTERIOR_PRICE,
} from '@/lib/constants/pricing'
import type { CarGrade, MonthlyCount } from '@/types'

export interface PriceTable {
  monthly: Record<string, Record<CarGrade, number>>
  onetime: Record<CarGrade, number>
  interior: number
}

// DB에 값 없을 때 상수값 fallback
const DEFAULT_PRICE_TABLE: PriceTable = {
  monthly: MONTHLY_PRICE_TABLE as Record<string, Record<CarGrade, number>>,
  onetime: ONETIME_PRICE_TABLE,
  interior: INTERIOR_PRICE,
}

let cachedPriceTable: PriceTable | null = null

export function usePricing() {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = supabase as any
  const [priceTable, setPriceTable] = useState<PriceTable>(cachedPriceTable ?? DEFAULT_PRICE_TABLE)
  const [loading, setLoading] = useState(!cachedPriceTable)
  const [saving, setSaving] = useState(false)

  const loadPriceTable = useCallback(async () => {
    setLoading(true)
    try {
      const result = await anyDb
        .from('app_settings')
        .select('value')
        .eq('key', 'price_table')
        .single()

      if (result.data?.value) {
        const table = result.data.value as PriceTable
        cachedPriceTable = table
        setPriceTable(table)
      }
    } catch {
      // fallback to defaults
    } finally {
      setLoading(false)
    }
  }, [anyDb])

  useEffect(() => {
    if (!cachedPriceTable) loadPriceTable()
  }, [loadPriceTable])

  function getMonthlyPrice(grade: CarGrade, count: MonthlyCount): number {
    if (count === 'onetime') return priceTable.onetime[grade] ?? 0
    return priceTable.monthly[count]?.[grade] ?? 0
  }

  function getUnitPrice(grade: CarGrade, count: MonthlyCount): number {
    if (count === 'onetime') return priceTable.onetime[grade] ?? 0
    const countMap: Record<string, number> = { monthly_1: 1, monthly_2: 2, monthly_4: 4 }
    const n = countMap[count] ?? 1
    return Math.round(getMonthlyPrice(grade, count) / n)
  }

  async function savePriceTable(newTable: PriceTable): Promise<boolean> {
    setSaving(true)
    try {
      const saveResult = await anyDb
        .from('app_settings')
        .upsert({ key: 'price_table', value: newTable, updated_at: new Date().toISOString() })
      if (!saveResult.error) {
        cachedPriceTable = newTable
        setPriceTable(newTable)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setSaving(false)
    }
  }

  return { priceTable, loading, saving, getMonthlyPrice, getUnitPrice, savePriceTable, reload: loadPriceTable }
}
