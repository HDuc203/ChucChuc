-- =====================================================
-- CHUC CHUC COFFEE - CRUD & SOFT DELETE MIGRATION
-- Chạy file này trong Supabase SQL Editor
-- =====================================================

-- 1. Thêm cột is_deleted cho bảng products và categories (Soft Delete)
alter table products add column if not exists is_deleted boolean not null default false;
alter table categories add column if not exists is_deleted boolean not null default false;

-- 2. Cập nhật RLS policies cho phép thêm/sửa/xóa mềm
alter table products enable row level security;
alter table categories enable row level security;

drop policy if exists "Public write products" on products;
create policy "Public write products" on products for all to anon, authenticated using (true) with check (true);

drop policy if exists "Public write categories" on categories;
create policy "Public write categories" on categories for all to anon, authenticated using (true) with check (true);

select 'Migration soft delete đã hoàn tất thành công!' as ket_qua;
