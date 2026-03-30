-- wash_photos 테이블 생성 (직원 작업 페이지 사진 업로드용)
CREATE TABLE IF NOT EXISTS wash_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  photo_url   TEXT NOT NULL,
  wash_date   DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Storage bucket 생성 (Supabase 대시보드에서 수동으로 만들어도 됩니다)
-- Bucket 이름: photos
-- Public: true (공개 버킷)

-- RLS 정책 (개발 중 전체 허용)
ALTER TABLE wash_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_wash_photos" ON wash_photos
  FOR ALL USING (true) WITH CHECK (true);
