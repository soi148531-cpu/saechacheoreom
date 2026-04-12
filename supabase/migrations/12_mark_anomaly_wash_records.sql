-- 비정상 세차 기록 표시 및 정산 제외
-- 1. wash_records 테이블에 is_anomaly 컬럼 추가
ALTER TABLE wash_records
ADD COLUMN is_anomaly BOOLEAN DEFAULT FALSE,
ADD COLUMN anomaly_reason TEXT;

-- 2. completed_by가 NULL인 모든 기록을 비정상으로 표시
UPDATE wash_records
SET 
  is_anomaly = TRUE,
  anomaly_reason = 'completed_by is NULL - invalid worker'
WHERE completed_by IS NULL;

-- 3. 같은 날 같은 차량 같은 worker의 중복 기록 (가장 오래된 것만 유지)
-- 임시 테이블로 중복 ID 찾기
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY wash_date, vehicle_id, completed_by 
      ORDER BY created_at ASC
    ) as rn
  FROM wash_records
  WHERE completed_by IS NOT NULL
)
UPDATE wash_records
SET 
  is_anomaly = TRUE,
  anomaly_reason = 'duplicate record - same date/vehicle/worker'
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 4. 결과 확인
SELECT 
  is_anomaly,
  anomaly_reason,
  COUNT(*) as count
FROM wash_records
GROUP BY is_anomaly, anomaly_reason
ORDER BY is_anomaly DESC;
