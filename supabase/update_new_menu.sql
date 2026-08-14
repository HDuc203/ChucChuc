-- =====================================================
-- CHÚC CHÚC COFFEE - UPDATE NEW MENU & CATEGORIES
-- Chạy file này trong Supabase SQL Editor để cập nhật thực đơn mới
-- =====================================================

-- 1. XÓA MỀM TẤT CẢ SẢN PHẨM & DANH MỤC CŨ (BẢO VỆ DỮ LIỆU ĐƠN CŨ)
update products set is_deleted = true where is_deleted = false;
update categories set is_deleted = true where is_deleted = false;

-- 2. TẠO CÁC DANH MỤC MỚI
insert into categories (id, name, sort_order) values
  ('c1000000-0001-0001-0001-000000000001', 'Cà phê', 1),
  ('c2000000-0002-0002-0002-000000000002', 'Matcha & Cacao', 2),
  ('c3000000-0003-0003-0003-000000000003', 'Nước ép & Sinh tố', 3),
  ('c4000000-0004-0004-0004-000000000004', 'Soda & Sữa chua', 4);

-- 3. THÊM TẤT CẢ SẢN PHẨM MỚI VÀO CƠ SỞ DỮ LIỆU

-- Nhóm 1: Cà phê
insert into products (category_id, name, price, is_available) values
  ('c1000000-0001-0001-0001-000000000001', 'Cafe Đen', 15000, true),
  ('c1000000-0001-0001-0001-000000000001', 'Cafe Sữa', 17000, true),
  ('c1000000-0001-0001-0001-000000000001', 'Cafe Muối', 18000, true),
  ('c1000000-0001-0001-0001-000000000001', 'Bạc Xỉu', 20000, true),
  ('c1000000-0001-0001-0001-000000000001', 'Cafe Caramel', 20000, true),
  ('c1000000-0001-0001-0001-000000000001', 'Cafe Sữa Tươi', 20000, true),
  ('c1000000-0001-0001-0001-000000000001', 'Cafe Sữa Dừa', 25000, true);

-- Nhóm 2: Matcha & Cacao
insert into products (category_id, name, price, is_available) values
  ('c2000000-0002-0002-0002-000000000002', 'Matcha Latte', 20000, true),
  ('c2000000-0002-0002-0002-000000000002', 'Matcha Kem Muối', 22000, true),
  ('c2000000-0002-0002-0002-000000000002', 'Matcha Caramel', 22000, true),
  ('c2000000-0002-0002-0002-000000000002', 'Matcha Dâu', 25000, true),
  ('c2000000-0002-0002-0002-000000000002', 'Cacao Sữa Đá', 17000, true),
  ('c2000000-0002-0002-0002-000000000002', 'Cacao Latte', 20000, true),
  ('c2000000-0002-0002-0002-000000000002', 'Cacao Kem Muối', 22000, true);

-- Nhóm 3: Nước ép & Sinh tố
insert into products (category_id, name, price, is_available) values
  ('c3000000-0003-0003-0003-000000000003', 'Nước Cam', 15000, true),
  ('c3000000-0003-0003-0003-000000000003', 'Ép Thơm', 15000, true),
  ('c3000000-0003-0003-0003-000000000003', 'Ép Cà Rốt', 15000, true),
  ('c3000000-0003-0003-0003-000000000003', 'Ép Cà Chua', 15000, true),
  ('c3000000-0003-0003-0003-000000000003', 'Sinh Tố Bơ', 20000, true);

-- Nhóm 4: Soda & Sữa chua
insert into products (category_id, name, price, is_available) values
  ('c4000000-0004-0004-0004-000000000004', 'Soda Dâu', 20000, true),
  ('c4000000-0004-0004-0004-000000000004', 'Soda Chanh', 20000, true),
  ('c4000000-0004-0004-0004-000000000004', 'Sữa Chua Đá', 20000, true),
  ('c4000000-0004-0004-0004-000000000004', 'Sữa Chua Dâu', 25000, true);

select 'CẬP NHẬT 23 MÓN MỚI CHO CHÚC CHÚC THÀNH CÔNG!' as ket_qua;
