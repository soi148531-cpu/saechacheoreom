-- Migration: 08_add_interior_count_to_vehicles.sql
-- 차량에 월 실내 세차 횟수 설정 추가 (0 = 실내 없음)

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS interior_count INTEGER DEFAULT 0;
