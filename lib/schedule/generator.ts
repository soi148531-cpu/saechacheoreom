// Design Ref: §3.3 — 네이버 캘린더 방식 반복 일정 생성
// Plan SC: SC-02 캘린더 월2회 반복 일정 정확 생성

export type RepeatMode = 'date' | 'weekday'
// date    : 매월 N일           (예: 매월 17일)
// weekday : 매월 N번째 요일     (월1회: 3번째 금요일 / 월2회: 1·3번째 월요일)

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

/** 시작일로부터 "매월 N번째 요일" 설명 텍스트 생성 (월1회용) */
export function getWeekdayLabel(startDate: Date): string {
  const nth = Math.ceil(startDate.getDate() / 7)
  const dow = WEEKDAY_KO[startDate.getDay()]
  return `매월 ${nth}번째 ${dow}요일`
}

/** 시작일로부터 "매월 1·3번째 / 2·4번째 요일" 설명 텍스트 생성 (월2회용) */
export function getBiweeklyWeekdayLabel(startDate: Date): string {
  const nth = Math.ceil(startDate.getDate() / 7)
  const dow = WEEKDAY_KO[startDate.getDay()]
  const pair = nth % 2 === 1 ? '1·3' : '2·4'
  return `매월 ${pair}번째 ${dow}요일`
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
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** YYYY-MM-DD 문자열을 로컬 시간 기준으로 파싱 (UTC 해석 방지) */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
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

/**
 * 월2회 — 매월 1·3번째 요일 또는 2·4번째 요일
 * 시작일이 1번째/3번째 요일 → 매월 1·3번째 같은 요일
 * 시작일이 2번째/4번째 요일 → 매월 2·4번째 같은 요일
 * 예: 시작일=첫째 월요일 → 매월 1번째·3번째 월요일
 */
function monthlyTwiceByWeekday(
  vehicleId: string,
  startDate: Date,
  monthsAhead: number
): ScheduleItem[] {
  const result: ScheduleItem[] = []
  const targetDow = startDate.getDay()
  const targetNth = Math.ceil(startDate.getDate() / 7)
  // 홀수(1, 3, 5) → 1·3번째, 짝수(2, 4) → 2·4번째
  const nths = targetNth % 2 === 1 ? [1, 3] : [2, 4]

  for (let m = 0; m <= monthsAhead; m++) {
    const firstOfMonth = new Date(startDate.getFullYear(), startDate.getMonth() + m, 1)
    const year  = firstOfMonth.getFullYear()
    const month = firstOfMonth.getMonth()
    const firstDow = firstOfMonth.getDay()
    const firstOccurrence = 1 + ((targetDow - firstDow + 7) % 7)

    for (const nth of nths) {
      const day = firstOccurrence + (nth - 1) * 7
      const d = new Date(year, month, day)
      if (d.getMonth() === month) {
        result.push({ vehicle_id: vehicleId, scheduled_date: toDateStr(d) })
      }
    }
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
  monthsAhead = 24
): ScheduleItem[] {
  let schedules: ScheduleItem[]

  if (monthlyCount === 'monthly_1') {
    schedules = repeatMode === 'weekday'
      ? monthlyByWeekday(vehicleId, startDate, monthsAhead)
      : monthlyByDate(vehicleId, startDate, monthsAhead)
  } else if (monthlyCount === 'monthly_2') {
    schedules = repeatMode === 'weekday'
      ? monthlyTwiceByWeekday(vehicleId, startDate, monthsAhead)
      : byInterval(vehicleId, startDate, 14, monthsAhead)
  } else {
    schedules = byInterval(vehicleId, startDate, 7, monthsAhead)
  }

  return detectOvercount(schedules, monthlyCount)
}

/**
 * 초과 횟수 감지: 월 플랜보다 실제 일정이 많은 경우 is_overcount = true
 * monthly_1 → 월 2회 이상, monthly_2 → 월 3회 이상, monthly_4 → 월 5회 이상
 */
export function detectOvercount(
  schedules: ScheduleItem[],
  monthlyCount: 'monthly_1' | 'monthly_2' | 'monthly_4' = 'monthly_2'
): ScheduleItem[] {
  const threshold = monthlyCount === 'monthly_1' ? 1 : monthlyCount === 'monthly_4' ? 4 : 2
  const byMonth: Record<string, number> = {}
  schedules.forEach(s => {
    const ym = s.scheduled_date.slice(0, 7)
    byMonth[ym] = (byMonth[ym] ?? 0) + 1
  })
  return schedules.map(s => ({
    ...s,
    is_overcount: byMonth[s.scheduled_date.slice(0, 7)] > threshold,
  }))
}
