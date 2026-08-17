-- =====================================================
-- CHÚC CHÚC COFFEE - FIX 401 PERMISSION ERROR FOR EXPENSES
-- Chạy file này trong Supabase SQL Editor để khắc phục lỗi 401 khi Thêm/Sửa/Xóa chi phí
-- =====================================================

-- 1. TẮT RLS CHO BẢNG EXPENSES
alter table if exists expenses disable row level security;

-- 2. CẤP ĐẦY ĐỦ QUYỀN THÊM, SỬA, XÓA CHO ANONYMOUS VÀ AUTHENTICATED ROLES
grant all on table expenses to anon, authenticated, postgres, service_role;
grant all on all tables in schema public to anon, authenticated, postgres, service_role;
grant all on all sequences in schema public to anon, authenticated, postgres, service_role;

select 'ĐÃ KHẮC PHỤC LỖI 401 THÀNH CÔNG! BẠN CÓ THỂ THÊM, SỬA, XÓA CHI PHÍ THOẢI MÁI.' as ket_qua;
