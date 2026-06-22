-- =====================================================
-- Supabase API 접근 권한 명시적 부여
-- 배경: 2026-10-30부터 Supabase는 public 스키마 테이블에
--       자동 권한 부여를 중단함. 명시적 GRANT 필요.
-- =====================================================

-- 고객/차량/일정 (핵심 데이터)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE customers         TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vehicles          TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE schedules         TO anon, authenticated;

-- 세차 실적 / 사진
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wash_records      TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wash_photos       TO anon, authenticated;

-- 청구/정산
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE billings          TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE billing_items     TO anon, authenticated;

-- 직원/급여
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE workers           TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE worker_payrolls   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE worker_rate_settings TO anon, authenticated;

-- 설정/메시지
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app_settings      TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE message_templates TO anon, authenticated;

-- 쿠폰
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE customer_coupons  TO anon, authenticated;
