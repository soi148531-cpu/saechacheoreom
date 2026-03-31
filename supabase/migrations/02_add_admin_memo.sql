-- 관리자 메모 컬럼 추가 (캘린더에서 직원에게 지시사항 전달)
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS admin_memo TEXT;
