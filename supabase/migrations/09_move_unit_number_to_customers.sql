-- 동호수(unit_number)를 vehicles에서 customers로 이동

-- 1. customers 테이블에 unit_number 컬럼 추가
ALTER TABLE customers ADD COLUMN IF NOT EXISTS unit_number TEXT;

-- 2. vehicles 테이블의 unit_number 데이터를 customers 테이블로 마이그레이션
-- (각 고객의 첫 번째 차량의 unit_number를 고객의 unit_number로 설정)
UPDATE customers c
SET unit_number = (
  SELECT unit_number 
  FROM vehicles v 
  WHERE v.customer_id = c.id 
  ORDER BY v.created_at ASC
  LIMIT 1
)
WHERE unit_number IS NULL;

-- 3. vehicles 테이블에서 unit_number 컬럼 제거
ALTER TABLE vehicles DROP COLUMN IF EXISTS unit_number;
