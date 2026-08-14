-- =====================================================
-- CHUC CHUC COFFEE - REPORT & ANALYTICS VIEWS
-- Chạy file này trong Supabase SQL Editor
-- =====================================================

-- 1. View Doanh thu theo Ngày (kèm phân loại Tiền mặt / Chuyển khoản & Mang về / Tại bàn)
create or replace view revenue_by_day as
select 
  date(paid_at) as day,
  sum(total_amount) as total_revenue,
  count(*) as total_orders,
  sum(case when payment_method = 'cash' then total_amount else 0 end) as cash_revenue,
  sum(case when payment_method in ('transfer', 'qr') then total_amount else 0 end) as transfer_revenue,
  sum(case when order_type = 'takeaway' then total_amount else 0 end) as takeaway_revenue,
  sum(case when order_type = 'dine_in' then total_amount else 0 end) as dine_in_revenue
from orders
where status = 'paid' and paid_at is not null
group by date(paid_at)
order by day desc;

-- 2. View Top 10 Món bán chạy nhất
create or replace view top_products as
select 
  p.id as product_id,
  p.name as product_name,
  sum(oi.quantity) as total_sold,
  sum(oi.quantity * oi.unit_price) as total_revenue
from order_items oi
join products p on p.id = oi.product_id
join orders o on o.id = oi.order_id
where o.status = 'paid'
group by p.id, p.name
order by total_sold desc;

-- 3. View Khung giờ cao điểm trong ngày
create or replace view revenue_by_hour as
select 
  extract(hour from paid_at)::int as hour_of_day,
  count(*) as order_count,
  sum(total_amount) as total_revenue
from orders
where status = 'paid' and paid_at is not null
group by extract(hour from paid_at)
order by hour_of_day;

-- Cho phép đọc công khai các view (nếu RLS bật)
grant select on revenue_by_day to anon, authenticated;
grant select on top_products to anon, authenticated;
grant select on revenue_by_hour to anon, authenticated;

select 'Views báo cáo đã được khởi tạo thành công!' as ket_qua;
