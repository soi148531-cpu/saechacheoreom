import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
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
 * 청구 정보로 상세 메시지 생성
 * @param billing - 청구 데이터 (vehicle 포함)
 * @param yearMonth - 년월 (예: "2026-04")
 * @param records - 세차 기록
 */
/**
 * 고객의 여러 청구 정보로 상세 메시지 생성
 * @param customerName - 고객명
 * @param phone - 연락처
 * @param month - 월 (예: "4")
 * @param vehicleDetails - 차량별 청구 정보 배열
 * @param totalAmount - 전체 청구 금액
 */
/**
 * 고객의 여러 청구 정보로 상세 메시지 생성 (DB 템플릿 기반)
 */
export async function buildDetailedBillingMessage(
  customerName: string,
  phone: string | null,
  month: string,
  vehicleDetails: Array<{
    carName: string
    plateNumber: string
    records: Array<{ date: string; price: number }>
    subtotal: number
  }>,
  totalAmount: number
): Promise<string> {
  const template = await getMessageTemplate('billing_notification')

  // 차량별 세차 내역 생성 (반복 부분)
  const vehicleText = vehicleDetails.map(vehicle => {
    const lines: string[] = []
    lines.push(`[${vehicle.carName}] ${vehicle.plateNumber}`)
    vehicle.records.forEach(r => {
      lines.push(`   ${r.date} 세차: ${formatPrice(r.price)}`)
    })
    lines.push(`  소계: ${formatPrice(vehicle.subtotal)}`)
    return lines.join('\n')
  }).join('\n\n')

  if (!template) {
    // 폴백 (DB 없을 때)
    return [
      `[새차처럼] ${month}월 세차 청구 안내`,
      '',
      `고객명: ${customerName} 님`,
      phone ? `연락처: ${phone}` : '',
      '',
      vehicleText,
      '',
      `총 청구금액: ${formatPrice(totalAmount)}원`,
      '입금계좌: (계좌 정보)',
    ].filter(l => l !== undefined).join('\n')
  }

  // DB 템플릿의 변수를 실제 값으로 치환
  return renderMessageTemplate(template.message_body, {
    customer_name: customerName,
    phone: phone || '',
    month: `${month}`,
    vehicle_details: vehicleText,
    total_amount: formatPrice(totalAmount),
  })
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
