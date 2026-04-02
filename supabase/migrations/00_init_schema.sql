-- =====================================================
-- 새차처럼 앱 전체 스키마 초기화
-- Supabase SQL Editor에서 이 파일 전체를 붙여넣고 실행하세요
-- =====================================================

-- 1. 고객 테이블
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  phone       TEXT,
  apartment   TEXT NOT NULL DEFAULT '',
  unit_number TEXT,
  memo        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 차량 테이블
CREATE TABLE IF NOT EXISTS vehicles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  car_name       TEXT NOT NULL,
  plate_number   TEXT NOT NULL UNIQUE,
  car_grade      TEXT NOT NULL DEFAULT 'mid_suv',
  monthly_count  TEXT NOT NULL DEFAULT 'monthly_2',
  repeat_mode    TEXT NOT NULL DEFAULT 'date',
  monthly_price  INTEGER,
  unit_price     INTEGER,
  start_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date       DATE,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 일정 테이블
CREATE TABLE IF NOT EXISTS schedules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id     UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  schedule_type  TEXT NOT NULL DEFAULT 'regular',
  is_overcount   BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vehicle_id, scheduled_date)
);

-- 4. 세차 실적 테이블
CREATE TABLE IF NOT EXISTS wash_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id     UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  schedule_id    UUID REFERENCES schedules(id),
  wash_date      DATE NOT NULL,
  price          INTEGER NOT NULL DEFAULT 0,
  service_type   TEXT NOT NULL DEFAULT 'regular',
  is_completed   BOOLEAN NOT NULL DEFAULT TRUE,
  completed_at   TIMESTAMPTZ DEFAULT NOW(),
  memo           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 사진 테이블 (직원 업로드)
CREATE TABLE IF NOT EXISTS wash_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  photo_url   TEXT NOT NULL,
  wash_date   DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 청구 테이블
CREATE TABLE IF NOT EXISTS billings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id     UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  year_month     TEXT NOT NULL,
  wash_count     INTEGER NOT NULL DEFAULT 0,
  total_amount   INTEGER NOT NULL DEFAULT 0,
  paid_amount    INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  memo           TEXT,
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vehicle_id, year_month)
);

-- 7. 청구 상세 항목 (POS)
CREATE TABLE IF NOT EXISTS billing_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id  UUID NOT NULL REFERENCES billings(id) ON DELETE CASCADE,
  item_name   TEXT NOT NULL,
  unit_price  INTEGER NOT NULL DEFAULT 0,
  quantity    INTEGER NOT NULL DEFAULT 1,
  amount      INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- RLS (Row Level Security) — 개발 중 전체 허용
-- =====================================================

ALTER TABLE customers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wash_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wash_photos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE billings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_items ENABLE ROW LEVEL SECURITY;

-- 전체 허용 정책 (개발용 — 나중에 인증 추가 시 제한)
CREATE POLICY "allow_all_customers"     ON customers     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_vehicles"      ON vehicles      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_schedules"     ON schedules     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_wash_records"  ON wash_records  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_wash_photos"   ON wash_photos   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_billings"      ON billings      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_billing_items" ON billing_items FOR ALL USING (true) WITH CHECK (true);
