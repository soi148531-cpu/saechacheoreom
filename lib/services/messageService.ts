import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import type { Billing, MessageTemplate, WashRecord } from '@/types'

const supabase = createClient()

/**
 * 메시지 템플릿 조회
 * @param templateKey - 템플릿 키 ('billing_notification')
 * @returns 템플릿 객체 또는 null
 */
export async function getMessageTemplate(templateKey: string) {
  const { data, error } = await (supabase as any)
    .from('message_templates')
    .select('*')
    .eq('template_key', templateKey)
    .single()

  if (error) {
    console.error('Template fetch failed:', error)
    return null
  }
  return data as MessageTemplate
}

/**
 * 메시지 템플릿 업데이트 (관리자용)
 * @param templateKey - 템플릿 키
 * @param messageBody - 새 메시지 본문
 */
export async function updateMessageTemplate(
  templateKey: string,
  messageBody: string
) {
  return await (supabase as any)
    .from('message_templates')
    .update({ message_body: messageBody, updated_at: new Date().toISOString() })
    .eq('template_key', templateKey)
}

/**
 * 메시지 템플릿에 변수 치환
 * @param template - 템플릿 문자열 (예: "{customer_name}님 - {amount}원")
 * @param variables - 치환할 변수 객체 (예: { customer_name: '김철수', amount: '17500' })
 * @returns 치환된 메시지
 */
export function renderMessageTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>
): string {
  let message = template
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g')
    message = message.replace(regex, String(value ?? ''))
  })
  return message
}

/**
 * 청구 정보로 상세 메시지 생성
 * @param billing - 청구 데이터 (vehicle 포함)
 * @param yearMonth - 년월 (예: "2026-04")
 * @param records - 세차 기록
 */
export async function buildBillingMessage(
  billing: Billing,
  yearMonth: string,
  records: WashRecord[] = []
): Promise<string> {
  const [year, month] = yearMonth.split('-')
  const monthNum = parseInt(month, 10)

  let lines: string[] = []

  // 헤더
  lines.push(`[새차처럼] ${monthNum}월 세차 청구 안내`)
  lines.push('')

  // 고객 정보
  const customerName = billing.vehicle?.customer?.name || '고객'
  lines.push(`고객명: ${customerName} 님`)

  const phone = billing.vehicle?.customer?.phone
  if (phone) {
    lines.push(`연락처: ${phone}`)
  }
  lines.push('')

  // 차량 정보
  const carName = billing.vehicle?.car_name || ''
  const plateNumber = billing.vehicle?.plate_number || ''
  lines.push(`[${carName}] ${plateNumber}`)

  // 세차 내역
  if (records.length > 0) {
    records.forEach(r => {
      const d = new Date(r.wash_date)
      const day = d.getDate()
      lines.push(`   ${monthNum}/${day} 세차: ${formatPrice(r.price)}`)
    })
  }

  // 소계
  const washTotal = records.reduce((sum, r) => sum + r.price, 0)
  lines.push(`  소계: ${formatPrice(washTotal)}`)
  lines.push('')

  // 총액
  lines.push(`총 청구금액: ${formatPrice(billing.total_amount)}원`)
  lines.push(`입금계좌: (계좌정보)`)

  return lines.join('\n')
}

/**
 * 발송 상태 업데이트
 */
export async function updateMessageSentAt(billingId: string) {
  return await (supabase as any)
    .from('billings')
    .update({ message_sent_at: new Date().toISOString() })
    .eq('id', billingId)
}

/**
 * 메시지 시간 포맷
 */
export function formatMessageTime(messageSentAt: string | null): string {
  if (!messageSentAt) return '미발송'
  const date = new Date(messageSentAt)
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

/**
 * 청구 목록 필터
 */
export function filterMessageStatus(
  billings: Billing[],
  filter: 'all' | 'sent' | 'unsent'
): Billing[] {
  if (filter === 'sent') return billings.filter(b => b.message_sent_at !== null)
  if (filter === 'unsent') return billings.filter(b => b.message_sent_at === null)
  return billings
}
