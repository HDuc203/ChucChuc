-- =====================================================
-- BẢN CẬP NHẬT DATABASE DÀNH CHO CÁC TÍNH NĂNG MỚI
-- (An toàn: Không xóa dữ liệu cũ, chỉ bổ sung cột & quyền mới)
-- =====================================================

-- 1. Bổ sung cột ghi chú 'note' cho bảng order_items (nếu chưa có)
alter table order_items add column if not exists note text;

-- 2. Bổ sung cột xóa mềm 'is_deleted' cho products và categories
alter table products add column if not exists is_deleted boolean not null default false;
alter table categories add column if not exists is_deleted boolean not null default false;

-- 3. Đảm bảo bảng orders có cột paid_at và payment_method
alter table orders add column if not exists paid_at timestamptz;
alter table orders add column if not exists payment_method text;

-- 4. Tắt RLS để quán thao tác dữ liệu nội bộ không bị chặn
alter table categories disable row level security;
alter table products disable row level security;
alter table tables disable row level security;
alter table orders disable row level security;
alter table order_items disable row level security;

-- 5. Cấp quyền upload ảnh cho bucket 'product-images'
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Give anon full access to product-images" on storage.objects;
create policy "Give anon full access to product-images"
  on storage.objects for all to anon, authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

-- 6. Tạo/Cập nhật các hàm báo cáo doanh thu theo năm và tháng
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

grant execute on function revenue_by_year(int) to anon, authenticated;
grant execute on function revenue_detail_by_month(int, int) to anon, authenticated;

select 'CẬP NHẬT DATABASE TÍNH NĂNG MỚI THÀNH CÔNG (DỮ LIỆU CŨ ĐƯỢC GIỮ NGUYÊN)!' as ket_qua;
