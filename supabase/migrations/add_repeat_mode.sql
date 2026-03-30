-- vehicles 테이블에 repeat_mode 컬럼 추가
-- (월1회 반복방식: date=매월N일, weekday=N번째요일)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS repeat_mode TEXT DEFAULT 'date';
