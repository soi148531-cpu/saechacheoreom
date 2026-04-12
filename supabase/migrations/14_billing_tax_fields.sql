-- Migration: 14_billing_tax_fields.sql
-- 청구서에 입금 날짜, 결제 수단(증빙 종류) 추가

ALTER TABLE billings
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NULL;

-- payment_method: 'cash' | 'card' | 'cash_receipt'
ALTER TABLE billings
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL;
