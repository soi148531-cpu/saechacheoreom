-- ================================================================
-- 지출내역 기능 마이그레이션
-- Supabase > SQL Editor 에 붙여넣고 실행하세요
-- ================================================================

-- 1. 카테고리 테이블
create table if not exists expense_categories (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  created_at  timestamptz default now() not null
);

-- 2. 고정지출 설정 테이블
create table if not exists expense_recurring (
  id            uuid default gen_random_uuid() primary key,
  name          text not null,
  category_id   uuid references expense_categories(id) on delete set null,
  amount        integer not null default 0,
  day_of_month  integer not null check (day_of_month between 1 and 31),
  is_active     boolean default true not null,
  created_at    timestamptz default now() not null
);

-- 3. 실제 지출 내역 테이블
create table if not exists expenses (
  id            uuid default gen_random_uuid() primary key,
  year_month    text not null,          -- 'YYYY-MM' 형식 (통계 조회용)
  date          date not null,
  category_id   uuid references expense_categories(id) on delete set null,
  amount        integer not null default 0,
  memo          text,
  is_recurring  boolean default false not null,
  recurring_id  uuid references expense_recurring(id) on delete set null,
  created_at    timestamptz default now() not null
);

-- 4. 인덱스 (월별 조회 성능)
create index if not exists expenses_year_month_idx on expenses(year_month);

-- 5. RLS 정책 (앱에서 인증 없이 사용하므로 전체 허용)
alter table expense_categories enable row level security;
alter table expense_recurring  enable row level security;
alter table expenses           enable row level security;

create policy "allow_all_expense_categories" on expense_categories for all using (true) with check (true);
create policy "allow_all_expense_recurring"  on expense_recurring  for all using (true) with check (true);
create policy "allow_all_expenses"           on expenses           for all using (true) with check (true);
