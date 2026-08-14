-- =====================================================
-- FIX SUPABASE STORAGE RLS POLICY FOR IMAGE UPLOAD
-- Chạy file này trong Supabase SQL Editor
-- =====================================================

-- 1. Tạo hoặc cập nhật bucket 'product-images' công khai
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- 2. Xóa các policy cũ để tránh xung đột
drop policy if exists "Public read product images" on storage.objects;
drop policy if exists "Public upload product images" on storage.objects;
drop policy if exists "Public update product images" on storage.objects;
drop policy if exists "Public delete product images" on storage.objects;
drop policy if exists "Give anon full access to product-images" on storage.objects;

-- 3. Tạo Policy cấp toàn bộ quyền Upload, Đọc, Sửa, Xóa ảnh trong bucket 'product-images' cho người dùng
create policy "Give anon full access to product-images"
  on storage.objects
  for all
  to anon, authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

select 'Cấu hình quyền Upload ảnh Supabase Storage thành công!' as ket_qua;
