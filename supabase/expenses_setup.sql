-- =====================================================
-- CHÚC CHÚC COFFEE - EXPENSES & PROFIT SETUP
-- Chạy file này trong Supabase SQL Editor để kích hoạt Quản lý Chi phí & Lợi nhuận
-- =====================================================

-- 1. TẠO BẢNG CHI PHÍ (EXPENSES)
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,        -- vd: "Mua trà, sữa, đường"
  amount numeric(10,0) not null,
  category text default 'nguyen_lieu', -- 'nguyen_lieu' | 'dien_nuoc' | 'mat_bang' | 'luong' | 'khac'
  expense_date date not null default current_date,
  created_at timestamptz default now()
);

-- Tắt RLS & Cấp quyền đầy đủ
alter table expenses disable row level security;
grant all on table expenses to anon, authenticated, postgres, service_role;
grant all on all tables in schema public to anon, authenticated, postgres, service_role;

-- 2. VIEW CHI PHÍ THEO THÁNG
create or replace view expenses_by_month as
select 
  date_trunc('month', expense_date) as month,
  category,
  sum(amount) as total_expense
from expenses
group by date_trunc('month', expense_date), category;

-- 3. VIEW LỢI NHUẬN THEO THÁNG (DOANH THU - CHI PHÍ = LỢI NHUẬN)
create or replace view profit_by_month as
select 
  coalesce(r.month, e.month) as month,
  coalesce(r.revenue, 0) as revenue,
  coalesce(e.total_expense, 0) as expense,
  coalesce(r.revenue, 0) - coalesce(e.total_expense, 0) as profit
from (
  select date_trunc('month', paid_at) as month, sum(total_amount) as revenue
  from orders
  where status = 'paid'
  group by date_trunc('month', paid_at)
) r
full outer join (
  select date_trunc('month', expense_date) as month, sum(amount) as total_expense
  from expenses
  group by date_trunc('month', expense_date)
) e on r.month = e.month
order by month desc;

select 'ĐÃ KHỞI TẠO BẢNG CHI PHÍ & TÍNH LỢI NHUẬN THÀNH CÔNG!' as ket_qua;
