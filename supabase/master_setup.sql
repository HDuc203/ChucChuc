-- =====================================================
-- CHÚC CHÚC COFFEE - MASTER DATABASE SETUP
-- Chạy 1 lần duy nhất trong Supabase SQL Editor
-- =====================================================

-- 1. BẢNG DANH MỤC (CATEGORIES)
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 1,
  is_deleted boolean not null default false,
  created_at timestamptz default now()
);

-- 2. BẢNG SẢN PHẨM (PRODUCTS)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name text not null,
  price numeric not null default 0,
  image_url text,
  is_available boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz default now()
);

-- 3. BẢNG BÀN (TABLES)
create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'empty', -- 'empty', 'occupied', 'needs_cleaning'
  created_at timestamptz default now()
);

-- 4. BẢNG ĐƠN HÀNG (ORDERS)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_type text not null, -- 'takeaway', 'dine_in'
  table_id uuid references tables(id) on delete set null,
  status text not null default 'open', -- 'open', 'paid', 'cancelled'
  payment_method text, -- 'cash', 'transfer', 'qr'
  total_amount numeric not null default 0,
  created_at timestamptz default now(),
  paid_at timestamptz
);

-- 5. BẢNG CHI TIẾT ĐƠN HÀNG (ORDER_ITEMS)
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  quantity int not null default 1,
  unit_price numeric not null default 0,
  note text,
  created_at timestamptz default now()
);

-- 6. BẢNG CÀI ĐẶT NGÂN HÀNG (BANK_SETTINGS)
create table if not exists bank_settings (
  id uuid primary key default gen_random_uuid(),
  bank_code text not null default 'mbbank',
  account_number text not null default '0964544341',
  account_name text not null default 'HUYNH THI THANH TRUC',
  template text not null default 'compact2',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. TẮT RLS TOÀN BỘ CÁC BẢNG (CHO QUÁN NHỎ NỘI BỘ THAO TÁC TRỰC TIẾP)
alter table categories disable row level security;
alter table products disable row level security;
alter table tables disable row level security;
alter table orders disable row level security;
alter table order_items disable row level security;
alter table bank_settings disable row level security;

-- 7. TẠO BUCKET LƯU ÁNH SẢN PHẨM (PRODUCT-IMAGES)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Give anon full access to product-images" on storage.objects;
create policy "Give anon full access to product-images"
  on storage.objects for all to anon, authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

-- 8. THÊM DỮ LIỆU MẪU (SEED DATA)
delete from order_items;
delete from orders;
delete from products;
delete from categories;
delete from tables;

insert into categories (id, name, sort_order) values
  ('c1000000-0001-0001-0001-000000000001', 'Cà phê', 1),
  ('c2000000-0002-0002-0002-000000000002', 'Matcha & Cacao', 2),
  ('c3000000-0003-0003-0003-000000000003', 'Nước ép & Sinh tố', 3),
  ('c4000000-0004-0004-0004-000000000004', 'Soda & Sữa chua', 4);

insert into products (category_id, name, price, is_available) values
  ('c1000000-0001-0001-0001-000000000001', 'Cafe Đen', 15000, true),
  ('c1000000-0001-0001-0001-000000000001', 'Cafe Sữa', 17000, true),
  ('c1000000-0001-0001-0001-000000000001', 'Cafe Muối', 18000, true),
  ('c1000000-0001-0001-0001-000000000001', 'Bạc Xỉu', 20000, true),
  ('c1000000-0001-0001-0001-000000000001', 'Cafe Caramel', 20000, true),
  ('c1000000-0001-0001-0001-000000000001', 'Cafe Sữa Tươi', 20000, true),
  ('c1000000-0001-0001-0001-000000000001', 'Cafe Sữa Dừa', 25000, true),
  ('c2000000-0002-0002-0002-000000000002', 'Matcha Latte', 20000, true),
  ('c2000000-0002-0002-0002-000000000002', 'Matcha Kem Muối', 22000, true),
  ('c2000000-0002-0002-0002-000000000002', 'Matcha Caramel', 22000, true),
  ('c2000000-0002-0002-0002-000000000002', 'Matcha Dâu', 25000, true),
  ('c2000000-0002-0002-0002-000000000002', 'Cacao Sữa Đá', 17000, true),
  ('c2000000-0002-0002-0002-000000000002', 'Cacao Latte', 20000, true),
  ('c2000000-0002-0002-0002-000000000002', 'Cacao Kem Muối', 22000, true),
  ('c3000000-0003-0003-0003-000000000003', 'Nước Cam', 15000, true),
  ('c3000000-0003-0003-0003-000000000003', 'Ép Thơm', 15000, true),
  ('c3000000-0003-0003-0003-000000000003', 'Ép Cà Rốt', 15000, true),
  ('c3000000-0003-0003-0003-000000000003', 'Ép Cà Chua', 15000, true),
  ('c3000000-0003-0003-0003-000000000003', 'Sinh Tố Bơ', 20000, true),
  ('c4000000-0004-0004-0004-000000000004', 'Soda Dâu', 20000, true),
  ('c4000000-0004-0004-0004-000000000004', 'Soda Chanh', 20000, true),
  ('c4000000-0004-0004-0004-000000000004', 'Sữa Chua Đá', 20000, true),
  ('c4000000-0004-0004-0004-000000000004', 'Sữa Chua Dâu', 25000, true);

insert into tables (id, name, status) values
  ('c1d2e3f4-0001-0001-0001-000000000001', 'Bàn 1', 'empty'),
  ('c1d2e3f4-0002-0002-0002-000000000002', 'Bàn 2', 'empty'),
  ('c1d2e3f4-0003-0003-0003-000000000003', 'Bàn 3', 'empty'),
  ('c1d2e3f4-0004-0004-0004-000000000004', 'Bàn 4', 'empty'),
  ('c1d2e3f4-0005-0005-0005-000000000005', 'Bàn 5', 'empty'),
  ('c1d2e3f4-0006-0006-0006-000000000006', 'Bàn 6', 'empty'),
  ('c1d2e3f4-0007-0007-0007-000000000007', 'Bàn 7', 'empty'),
  ('c1d2e3f4-0008-0008-0008-000000000008', 'Bàn 8', 'empty'),
  ('c1d2e3f4-0009-0009-0009-000000000009', 'Bàn 9', 'empty'),
  ('c1d2e3f4-0010-0010-0010-000000000010', 'Bàn 10', 'empty');

-- 9. TẠO CÁC HÀM ANALYTICS
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

grant execute on function revenue_by_year(int) to anon, authenticated;

select 'KHỞI TẠO TOÀN BỘ CƠ SỞ DỮ LIỆU CHÚC CHÚC THÀNH CÔNG!' as ket_qua;
