-- =====================================================
-- CHUC CHUC COFFEE - YEARLY & MONTHLY DRILL-DOWN RPC FUNCTIONS
-- Chạy file này trong Supabase SQL Editor
-- =====================================================

-- 1. Hàm lấy doanh thu 12 tháng trong 1 năm (dùng vẽ biểu đồ cột)
create or replace function revenue_by_year(target_year int)
returns table(month int, revenue numeric, order_count bigint)
language sql as $$
  with merged_daily as (
    select day, total_revenue, total_orders from daily_summaries
    where extract(year from day) = target_year
    union all
    select date(paid_at) as day, sum(total_amount) as total_revenue, count(*) as total_orders
    from orders
    where status = 'paid' and paid_at is not null
      and extract(year from paid_at) = target_year
      and date(paid_at) not in (select day from daily_summaries)
    group by date(paid_at)
  )
  select 
    extract(month from day)::int as month,
    sum(total_revenue) as revenue,
    sum(total_orders)::bigint as order_count
  from merged_daily
  group by extract(month from day)
  order by month;
$$;

-- 2. Hàm lấy chi tiết doanh thu theo từng ngày trong tháng được chọn
create or replace function revenue_detail_by_month(target_year int, target_month int)
returns table(day int, revenue numeric, order_count bigint)
language sql as $$
  with merged_daily as (
    select day, total_revenue, total_orders from daily_summaries
    where extract(year from day) = target_year
      and extract(month from day) = target_month
    union all
    select date(paid_at) as day, sum(total_amount) as total_revenue, count(*) as total_orders
    from orders
    where status = 'paid' and paid_at is not null
      and extract(year from paid_at) = target_year
      and extract(month from paid_at) = target_month
      and date(paid_at) not in (select day from daily_summaries)
    group by date(paid_at)
  )
  select 
    extract(day from day)::int as day,
    sum(total_revenue) as revenue,
    sum(total_orders)::bigint as order_count
  from merged_daily
  group by extract(day from day)
  order by day;
$$;

-- Cấp quyền gọi hàm cho người dùng
grant execute on function revenue_by_year(int) to anon, authenticated;
grant execute on function revenue_detail_by_month(int, int) to anon, authenticated;

select 'Hàm revenue_by_year và revenue_detail_by_month đã tạo thành công!' as ket_qua;
