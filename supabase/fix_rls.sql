-- =====================================================
-- FIX RLS: Cho phép đọc public (không cần đăng nhập)
-- Chạy trong Supabase SQL Editor
-- =====================================================

-- Bật RLS nhưng thêm policy cho phép đọc tất cả
alter table categories enable row level security;
alter table products enable row level security;
alter table tables enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- Cho phép đọc categories và products (ai cũng đọc được)
create policy "Public read categories"
  on categories for select using (true);

create policy "Public read products"
  on products for select using (true);

create policy "Public read tables"
  on tables for select using (true);

-- Cho phép insert/update orders (ai cũng tạo được đơn)
create policy "Public insert orders"
  on orders for insert with check (true);

create policy "Public update orders"
  on orders for update using (true);

-- Cho phép insert order_items
create policy "Public insert order_items"
  on order_items for insert with check (true);

create policy "Public select order_items"
  on order_items for select using (true);

-- Cho phép update tables (đổi trạng thái bàn)
create policy "Public update tables"
  on tables for update using (true);

select 'RLS policies đã được tạo thành công!' as ket_qua;
