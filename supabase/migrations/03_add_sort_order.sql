-- 일정 표시 순서 저장 (관리자가 드래그로 재정렬 시 저장됨)
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS sort_order INTEGER;
