// Design Ref: §3.3 — 네이버 캘린더 방식 반복 일정 생성
// Plan SC: SC-02 캘린더 월2회 반복 일정 정확 생성

export type RepeatMode = 'date' | 'weekday'
// date    : 매월 N일      (예: 매월 17일)
// weekday : 매월 N번째 요일 (예: 매월 3번째 금요일)

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

/** 시작일로부터 "매월 N번째 요일" 설명 텍스트 생성 */
export function getWeekdayLabel(startDate: Date): string {
  const nth = Math.ceil(startDate.getDate() / 7)
  const dow = WEEKDAY_KO[startDate.getDay()]
  return `매월 ${nth}번째 ${dow}요일`
}

/** 시작일로부터 "매월 N일" 설명 텍스트 생성 */
export function getDateLabel(startDate: Date): string {
  return `매월 ${startDate.getDate()}일`
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * 월1회 — 매월 특정 날짜 반복
 * 예: start=2026-03-17 → 4/17, 5/17, 6/17 ...
 * 단, 31일처럼 해당 월에 없는 날짜는 스킵
 */
function monthlyByDate(
  vehicleId: string,
  startDate: Date,
  monthsAhead: number
): ScheduleItem[] {
  const result: ScheduleItem[] = []
  const day = startDate.getDate()
  for (let m = 0; m <= monthsAhead; m++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + m, day)
    if (d.getDate() === day) {
      result.push({ vehicle_id: vehicleId, scheduled_date: toDateStr(d) })
    }
  }
  return result
}

/**
 * 월1회 — 매월 N번째 요일 반복
 * 예: start=2026-03-20(3번째 금요일) → 4월 3번째 금요일, 5월 3번째 금요일 ...
 */
function monthlyByWeekday(
  vehicleId: string,
  startDate: Date,
  monthsAhead: number
): ScheduleItem[] {
  const result: ScheduleItem[] = []
  const targetDow = startDate.getDay()                  // 요일 (0=일, 5=금)
  const targetNth = Math.ceil(startDate.getDate() / 7)  // 몇 번째 (1~5)

  for (let m = 0; m <= monthsAhead; m++) {
    const year  = startDate.getFullYear()
    const month = startDate.getMonth() + m
    const firstDow = new Date(year, month, 1).getDay()
    const firstOccurrence = 1 + ((targetDow - firstDow + 7) % 7)
    const date = firstOccurrence + (targetNth - 1) * 7
    const d = new Date(year, month, date)
    // 해당 월에 그 날짜가 존재하는지 확인 (5번째 요일이 없는 달 스킵)
    if (d.getMonth() === ((month % 12 + 12) % 12)) {
      result.push({ vehicle_id: vehicleId, scheduled_date: toDateStr(d) })
    }
  }
  return result
}

/**
 * 월2회/월4회 — 시작일로부터 N일 간격
 * 월2회: 14일 간격, 월4회: 7일 간격
 */
function byInterval(
  vehicleId: string,
  startDate: Date,
  interval: number,
  monthsAhead: number
): ScheduleItem[] {
  const result: ScheduleItem[] = []
  const endDate = addMonths(startDate, monthsAhead)
  let current = new Date(startDate)
  while (current <= endDate) {
    result.push({ vehicle_id: vehicleId, scheduled_date: toDateStr(current) })
    current = addDays(current, interval)
  }
  return result
}

export interface ScheduleItem {
  vehicle_id: string
  scheduled_date: string
  is_overcount?: boolean
}

/**
 * 메인 함수: 차량 등록 시 12개월치 일정 자동 생성
 */
export function generateSchedules(
  vehicleId: string,
  startDate: Date,
  monthlyCount: 'monthly_1' | 'monthly_2' | 'monthly_4',
  repeatMode: RepeatMode = 'date',
  monthsAhead = 12
): ScheduleItem[] {
  let schedules: ScheduleItem[]

  if (monthlyCount === 'monthly_1') {
    schedules = repeatMode === 'weekday'
      ? monthlyByWeekday(vehicleId, startDate, monthsAhead)
      : monthlyByDate(vehicleId, startDate, monthsAhead)
  } else {
    const interval = monthlyCount === 'monthly_2' ? 14 : 7
    schedules = byInterval(vehicleId, startDate, interval, monthsAhead)
  }

  return detectOvercount(schedules)
}

/**
 * 월3회 감지: 특정 월에 정확히 3회 생성된 경우 is_overcount = true
 */
export function detectOvercount(schedules: ScheduleItem[]): ScheduleItem[] {
  const byMonth: Record<string, number> = {}
  schedules.forEach(s => {
    const ym = s.scheduled_date.slice(0, 7)
    byMonth[ym] = (byMonth[ym] ?? 0) + 1
  })
  return schedules.map(s => ({
    ...s,
    is_overcount: byMonth[s.scheduled_date.slice(0, 7)] === 3,
  }))
}
