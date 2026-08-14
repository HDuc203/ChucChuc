-- =====================================================
-- CHUC CHUC COFFEE - MONTH-OVER-MONTH REVENUE COMPARISON
-- Chạy file này trong Supabase SQL Editor
-- =====================================================

create or replace view revenue_month_comparison as
select 
  month,
  revenue,
  order_count,
  lag(revenue) over (order by month) as prev_month_revenue,
  round(
    ((revenue - lag(revenue) over (order by month)) 
     / nullif(lag(revenue) over (order by month), 0)) * 100, 
    1
  ) as growth_percent
from (
  select 
    date_trunc('month', paid_at) as month,
    sum(total_amount) as revenue,
    count(*) as order_count
  from orders
  where status = 'paid' and paid_at is not null
  group by date_trunc('month', paid_at)
) monthly
order by month desc;

grant select on revenue_month_comparison to anon, authenticated;

select 'View revenue_month_comparison đã tạo thành công!' as ket_qua;
