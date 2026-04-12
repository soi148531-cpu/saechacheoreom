-- Disable RLS for worker_rate_settings table
-- RLS 정책이 제대로 작동하지 않으므로 비활성화
-- API에서는 백엔드 인증으로 보호됨

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Admin can view rates" ON worker_rate_settings;
DROP POLICY IF EXISTS "Admin can update rates" ON worker_rate_settings;
DROP POLICY IF EXISTS "Admin can insert rates" ON worker_rate_settings;

-- RLS 비활성화
ALTER TABLE worker_rate_settings DISABLE ROW LEVEL SECURITY;

-- 로그
SELECT 'RLS disabled for worker_rate_settings' as migration_status;
