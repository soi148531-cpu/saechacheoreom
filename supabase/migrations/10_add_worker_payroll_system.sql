-- 작업자 및 정산 시스템 추가 (2026-04-03)

-- 1. 작업자(직원) 정보 테이블
CREATE TABLE IF NOT EXISTS workers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  phone       TEXT,
  status      TEXT DEFAULT 'active',  -- active | inactive
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. wash_records에 작업자 정보 컬럼 추가
ALTER TABLE wash_records 
  ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES workers(id);
ALTER TABLE wash_records 
  ADD COLUMN IF NOT EXISTS worked_by TEXT DEFAULT 'admin';  -- 'worker' | 'admin'

-- 3. 작업자별 월별 정산 테이블
CREATE TABLE IF NOT EXISTS worker_payrolls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id     UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  year_month    TEXT NOT NULL,
  total_washes  INTEGER DEFAULT 0,
  total_amount  INTEGER DEFAULT 0,
  bonus_amount  INTEGER DEFAULT 0,
  paid_amount   INTEGER DEFAULT 0,
  paid_at       TIMESTAMPTZ,
  memo          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, year_month)
);

-- 4. 기본 직원 3명 등록 (예시)
INSERT INTO workers (name, status) VALUES
  ('김석진', 'active'),
  ('이재연', 'active'),
  ('박준호', 'active')
ON CONFLICT DO NOTHING;
