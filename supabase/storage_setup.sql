-- =====================================================
-- CHUC CHUC COFFEE - SUPABASE STORAGE BUCKET SETUP
-- Chạy file này trong Supabase SQL Editor để tạo bucket ảnh
-- =====================================================

-- 1. Tạo bucket public tên 'product-images'
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- 2. Cấp quyền Đọc công khai
drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');

-- 3. Cấp quyền Upload/Insert công khai
drop policy if exists "Public upload product images" on storage.objects;
create policy "Public upload product images" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'product-images');

-- 4. Cấp quyền Update công khai
drop policy if exists "Public update product images" on storage.objects;
create policy "Public update product images" on storage.objects
  for update to anon, authenticated using (bucket_id = 'product-images');

select 'Bucket product-images đã tạo thành công!' as ket_qua;
