-- =====================================================
-- CHUC CHUC COFFEE - SEED DATA
-- Chạy file này trong Supabase SQL Editor
-- =====================================================

-- 1. Xóa dữ liệu cũ nếu có (để chạy lại an toàn)
delete from order_item_toppings;
delete from order_items;
delete from orders;
delete from product_ingredients;
delete from products;
delete from categories;
delete from tables;

-- 2. Danh mục
insert into categories (id, name, sort_order) values
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Cà phê',   1),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'Nước ép',  2);

-- 3. Sản phẩm
insert into products (id, category_id, name, price, image_url, is_available) values
  -- Cà phê
  ('b1c2d3e4-0001-0001-0001-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'Cà phê sữa',     25000, null, true),
  ('b1c2d3e4-0002-0002-0002-000000000002', 'a1b2c3d4-0001-0001-0001-000000000001', 'Cacao',           30000, null, true),
  -- Nước ép
  ('b1c2d3e4-0003-0003-0003-000000000003', 'a1b2c3d4-0002-0002-0002-000000000002', 'Nước ép cà rốt', 30000, null, true),
  ('b1c2d3e4-0004-0004-0004-000000000004', 'a1b2c3d4-0002-0002-0002-000000000002', 'Nước ép cam',     32000, null, true),
  ('b1c2d3e4-0005-0005-0005-000000000005', 'a1b2c3d4-0002-0002-0002-000000000002', 'Nước ép thơm',   28000, null, true);

-- 4. Bàn (5 bàn)
insert into tables (id, name, status) values
  ('c1d2e3f4-0001-0001-0001-000000000001', 'Bàn 1', 'empty'),
  ('c1d2e3f4-0002-0002-0002-000000000002', 'Bàn 2', 'empty'),
  ('c1d2e3f4-0003-0003-0003-000000000003', 'Bàn 3', 'empty'),
  ('c1d2e3f4-0004-0004-0004-000000000004', 'Bàn 4', 'empty'),
  ('c1d2e3f4-0005-0005-0005-000000000005', 'Bàn 5', 'empty');

-- Kiểm tra kết quả
select 'categories' as bang, count(*) as so_luong from categories
union all
select 'products',   count(*) from products
union all
select 'tables',     count(*) from tables;
