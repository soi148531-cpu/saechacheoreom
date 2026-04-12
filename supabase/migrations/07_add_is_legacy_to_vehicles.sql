-- 기존 고객(오시오 이관) 여부 컬럼 추가
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN DEFAULT FALSE;
