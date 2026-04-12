-- Worker Rate Settings Table
-- 작업자 단가를 설정하관리하는 테이블

CREATE TABLE IF NOT EXISTS worker_rate_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 단가 정보
  outdoor_rate INTEGER NOT NULL DEFAULT 10000,      -- 실외세차 단가 (원/건)
  indoor_rate INTEGER NOT NULL DEFAULT 10000,       -- 실내청소 단가 (원/건)
  
  -- 메타데이터
  updated_by TEXT,                                  -- 마지막 수정자
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 이력 관리 (선택사항)
  effective_from DATE DEFAULT CURRENT_DATE,        -- 적용 시작 날짜
  notes TEXT                                        -- 변경 사유
);

-- 기본값 삽입 (최초 1회만)
INSERT INTO worker_rate_settings (outdoor_rate, indoor_rate, updated_by, notes)
SELECT 10000, 10000, 'admin', '초기 설정'
WHERE NOT EXISTS (SELECT 1 FROM worker_rate_settings);

-- 접근 권한 설정 (RLS - Row Level Security)
ALTER TABLE worker_rate_settings ENABLE ROW LEVEL SECURITY;

-- Admin만 읽고 쓸 수 있는 정책
CREATE POLICY "Admin can view rates" 
  ON worker_rate_settings 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can update rates" 
  ON worker_rate_settings 
  FOR UPDATE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can insert rates" 
  ON worker_rate_settings 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');
