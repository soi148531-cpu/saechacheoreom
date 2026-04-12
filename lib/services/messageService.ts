import { createClient } from '@/lib/supabase/client'
import type { Billing, MessageTemplate } from '@/types'

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
 * 청구 정보로 메시지 생성
 * @param billing - 청구 데이터 (vehicle 포함)
 * @param yearMonth - 년월 (예: "2026-04")
 */
export async function buildBillingMessage(
  billing: Billing,
  yearMonth: string
): Promise<string> {
  const template = await getMessageTemplate('billing_notification')
  if (!template) {
    // 폴백 메시지
    return `${billing.vehicle?.customer?.name ?? '고객'}님 - ${billing.total_amount}원 입금 부탁드립니다.`
  }

  const [year, month] = yearMonth.split('-')
  const variables = {
    customer_name: billing.vehicle?.customer?.name ?? '',
    car_name: billing.vehicle?.car_name ?? '',
    amount: billing.total_amount,
    unit_number: billing.vehicle?.customer?.unit_number ?? '',
    month: `${parseInt(month, 10)}월`
  }

  return renderMessageTemplate(template.message_body, variables)
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
