-- 세차 완료자 구분 컬럼 추가 ('worker' | 'admin')
ALTER TABLE wash_records ADD COLUMN IF NOT EXISTS completed_by TEXT;
