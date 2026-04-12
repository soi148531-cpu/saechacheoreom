-- 가격 관리 시스템
-- app_settings: 가격표 DB 관리
-- vehicles.custom_price: 차량별 개별 가격

-- 1. app_settings 테이블 생성
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 비활성화 (관리자만 접근하는 내부 설정)
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

-- 2. 초기 가격표 데이터 삽입
INSERT INTO app_settings (key, value) VALUES (
  'price_table',
  '{
    "monthly": {
      "monthly_1": {
        "small_sedan": 25000,
        "mid_sedan":   25000,
        "large_sedan": 30000,
        "xlarge_sedan":40000,
        "small_suv":   35000,
        "mid_suv":     45000,
        "large_suv":   50000,
        "xlarge_suv":  60000
      },
      "monthly_2": {
        "small_sedan": 30000,
        "mid_sedan":   35000,
        "large_sedan": 40000,
        "xlarge_sedan":45000,
        "small_suv":   45000,
        "mid_suv":     55000,
        "large_suv":   60000,
        "xlarge_suv":  70000
      },
      "monthly_4": {
        "small_sedan": 45000,
        "mid_sedan":   55000,
        "large_sedan": 65000,
        "xlarge_sedan":75000,
        "small_suv":   55000,
        "mid_suv":     65000,
        "large_suv":   70000,
        "xlarge_suv":  80000
      }
    },
    "onetime": {
      "small_sedan": 25000,
      "mid_sedan":   25000,
      "large_sedan": 30000,
      "xlarge_sedan":35000,
      "small_suv":   35000,
      "mid_suv":     45000,
      "large_suv":   50000,
      "xlarge_suv":  60000
    },
    "interior": 10000
  }'
) ON CONFLICT (key) DO NOTHING;

-- 3. vehicles 테이블에 custom_price 컬럼 추가
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS custom_price INTEGER DEFAULT NULL;

COMMENT ON COLUMN vehicles.custom_price IS '차량별 개별 월정가 오버라이드. NULL이면 기본 가격표 사용';
