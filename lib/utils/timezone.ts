/**
 * 한국 표준시(KST, UTC+9) 타임존 관련 유틸 함수
 * 모든 날짜 처리에 KST를 사용하도록 통일
 */

const KST_OFFSET = 9 * 60 * 60 * 1000; // 9시간

/**
 * 현재 시간을 KST로 반환
 * @returns ISO 8601 형식 문자열 (KST 기준)
 */
export function getNowKST(): Date {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + KST_OFFSET);
}

/**
 * 현재 날짜를 KST 기준 ISO 형식 날짜 문자열로 반환 (예: 2026-04-06)
 */
export function getTodayKST(): string {
  const now = getNowKST();
  return now.toISOString().split('T')[0];
}

/**
 * 주어진 Date 객체를 KST 기준의 ISO 날짜 문자열로 변환
 * @param date Date 객체
 * @returns ISO 8601 날짜 형식 (예: 2026-04-06)
 */
export function toKSTDateString(date: Date): string {
  const kstDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60 * 1000) + KST_OFFSET);
  return kstDate.toISOString().split('T')[0];
}

/**
 * 현재 시간을 KST 기준의 ISO 타임스탬프로 반환
 * @returns ISO 8601 타임스탬프 (예: 2026-04-06T15:30:45.000Z)
 */
export function getNowKSTTimestamp(): string {
  return getNowKST().toISOString();
}

/**
 * 클라이언트용: 사용자의 로컬 날짜를 KST 기준 날짜로 변환
 * Browser의 new Date()는 로컬 타임존을 사용하므로, 이를 KST로 표준화
 */
export function localDateToKSTDateString(): string {
  const now = new Date();
  // 로컬 타임존 오프셋을 고려하여 UTC로 변환
  const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000);
  // UTC에서 KST로 변환
  const kst = new Date(utc.getTime() + KST_OFFSET);
  return kst.toISOString().split('T')[0];
}

/**
 * 모든 시스템 날짜를 KST로 정규화
 * Supabase에서 받은 ISO 문자열을 KST로 처리
 */
export function normalizeToKST(isoString: string | Date): string {
  if (typeof isoString === 'string') {
    // ISO 문자열인 경우
    const date = new Date(isoString);
    return toKSTDateString(date);
  } else {
    // Date 객체인 경우
    return toKSTDateString(isoString);
  }
}
