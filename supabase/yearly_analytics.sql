-- =====================================================
-- CHUC CHUC COFFEE - YEARLY & MONTHLY DRILL-DOWN RPC FUNCTIONS
-- Chạy file này trong Supabase SQL Editor
-- =====================================================

-- 1. Hàm lấy doanh thu 12 tháng trong 1 năm (dùng vẽ biểu đồ cột)
create or replace function revenue_by_year(target_year int)
returns table(month int, revenue numeric, order_count bigint)
language sql as $$
  select 
    extract(month from paid_at)::int as month,
    sum(total_amount) as revenue,
    count(*) as order_count
  from orders
  where status = 'paid'
    and paid_at is not null
    and extract(year from paid_at) = target_year
  group by extract(month from paid_at)
  order by month;
$$;

-- 2. Hàm lấy chi tiết doanh thu theo từng ngày trong tháng được chọn
create or replace function revenue_detail_by_month(target_year int, target_month int)
returns table(day int, revenue numeric, order_count bigint)
language sql as $$
  select 
    extract(day from paid_at)::int as day,
    sum(total_amount) as revenue,
    count(*) as order_count
  from orders
  where status = 'paid'
    and paid_at is not null
    and extract(year from paid_at) = target_year
    and extract(month from paid_at) = target_month
  group by extract(day from paid_at)
  order by day;
$$;

-- Cấp quyền gọi hàm cho người dùng
grant execute on function revenue_by_year(int) to anon, authenticated;
grant execute on function revenue_detail_by_month(int, int) to anon, authenticated;

select 'Hàm revenue_by_year và revenue_detail_by_month đã tạo thành công!' as ket_qua;
