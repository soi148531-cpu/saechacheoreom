import type { CarGrade, MonthlyCount } from '@/types'

export const CAR_GRADE_LABELS: Record<CarGrade, string> = {
  small_sedan:  '소형세단',
  mid_sedan:    '중형세단',
  large_sedan:  '대형세단',
  xlarge_sedan: '특대형세단',
  small_suv:    '소형SUV',
  mid_suv:      '중형SUV',
  large_suv:    '대형SUV',
  xlarge_suv:   '특대형SUV',
}

export const MONTHLY_COUNT_LABELS: Record<MonthlyCount, string> = {
  new_customer: '신규차량',
  monthly_1:    '월1회',
  monthly_2:    '월2회',
  monthly_4:    '월4회',
  onetime:      '비정기',
}

// 월 정기 가격표 (월횟수 → 차량등급 → 월정가)
export const MONTHLY_PRICE_TABLE: Record<string, Record<CarGrade, number>> = {
  monthly_1: {
    small_sedan: 25000,  mid_sedan: 25000,  large_sedan: 30000,  xlarge_sedan: 40000,
    small_suv:  35000,   mid_suv:  45000,   large_suv:  50000,   xlarge_suv:  60000,
  },
  monthly_2: {
    small_sedan: 30000,  mid_sedan: 35000,  large_sedan: 40000,  xlarge_sedan: 45000,
    small_suv:  45000,   mid_suv:  55000,   large_suv:  60000,   xlarge_suv:  70000,
  },
  monthly_4: {
    small_sedan: 45000,  mid_sedan: 55000,  large_sedan: 65000,  xlarge_sedan: 75000,
    small_suv:  55000,   mid_suv:  65000,   large_suv:  70000,   xlarge_suv:  80000,
  },
}

// 일세차(비정기) 가격표
export const ONETIME_PRICE_TABLE: Record<CarGrade, number> = {
  small_sedan: 25000,  mid_sedan:   25000,  large_sedan: 30000,  xlarge_sedan: 35000,
  small_suv:  35000,   mid_suv:    45000,   large_suv:  50000,   xlarge_suv:  60000,
}

export const INTERIOR_PRICE = 10000

// 작업자 급여 계산 기준
export const WORKER_RATES = {
  OUTDOOR: 10000,    // 실외세차 1건당 (누구든)
  INDOOR: 10000,     // 실내청소 추가비 (누구든)
}

// 호환성 유지
export const WORKER_BASE_RATE = WORKER_RATES.OUTDOOR

// 월 정가 조회
export function getMonthlyPrice(grade: CarGrade, monthlyCount: MonthlyCount): number {
  if (monthlyCount === 'onetime' || monthlyCount === 'new_customer') return ONETIME_PRICE_TABLE[grade]
  return MONTHLY_PRICE_TABLE[monthlyCount]?.[grade] ?? 0
}

// 1회 단가 계산
export function getUnitPrice(grade: CarGrade, monthlyCount: MonthlyCount): number {
  if (monthlyCount === 'onetime' || monthlyCount === 'new_customer') return ONETIME_PRICE_TABLE[grade]
  const countMap: Record<string, number> = { monthly_1: 1, monthly_2: 2, monthly_4: 4 }
  const count = countMap[monthlyCount] ?? 1
  const monthly = MONTHLY_PRICE_TABLE[monthlyCount]?.[grade] ?? 0
  return Math.round(monthly / count)
}
