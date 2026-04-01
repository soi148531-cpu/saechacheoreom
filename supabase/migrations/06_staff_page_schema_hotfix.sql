-- 직원 페이지 저장/완료 기능 운영 DB 핫픽스
-- 기존 프로젝트에 누락된 컬럼을 한 번에 보강한다.

ALTER TABLE schedules ADD COLUMN IF NOT EXISTS admin_memo TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS sort_order INTEGER;

ALTER TABLE wash_records ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE wash_records ADD COLUMN IF NOT EXISTS completed_by TEXT;
