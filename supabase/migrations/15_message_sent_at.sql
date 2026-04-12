-- 카톡 발송 상태 추적
ALTER TABLE billings
  ADD COLUMN IF NOT EXISTS message_sent_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN billings.message_sent_at IS '카카오 비즈니스 메시지 발송 시각 (NULL = 미발송)';

-- 인덱스 추가 (필터링 성능)
CREATE INDEX IF NOT EXISTS idx_billings_message_sent_at
  ON billings(message_sent_at DESC);

-- 메시지 템플릿 테이블
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,  -- 'billing_notification' (향후 expand)
  message_body TEXT NOT NULL,  -- "{customer_name}님 - {car_name} {month} 청구액 {amount}원 입금 부탁드립니다."
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE message_templates IS '카톡 메시지 템플릿 (배포 없이 수정 가능)';
COMMENT ON COLUMN message_templates.template_key IS '템플릿 키 (billing_notification)';
COMMENT ON COLUMN message_templates.message_body IS '메시지 본문 (변수: {customer_name}, {phone}, {month}, {vehicle_details}, {total_amount})';

-- 초기 템플릿 데이터
INSERT INTO message_templates (template_key, message_body)
  VALUES ('billing_notification', '[새차처럼] {month}월 세차 청구 안내

고객명: {customer_name} 님
연락처: {phone}

{vehicle_details}

총 청구금액: {total_amount}원
입금계좌: (토스뱅크 1000-1996-3848) 박현제')
  ON CONFLICT (template_key) DO NOTHING;
