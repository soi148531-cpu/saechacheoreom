-- 세차 실적에 관리자 작업지시 메모 컬럼 추가
ALTER TABLE wash_records ADD COLUMN IF NOT EXISTS admin_note TEXT;
