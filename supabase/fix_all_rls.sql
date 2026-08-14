-- =====================================================
-- FIX ALL RLS POLICIES (POSTGRES TABLES & STORAGE)
-- Chạy file này 1 lần duy nhất trong Supabase SQL Editor
-- =====================================================

-- 1. Tắt RLS ở các bảng dữ liệu để thêm/sửa/xóa không bị chặn
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- 2. Cấu hình Storage Bucket public và mở quyền Upload ảnh
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Give anon full access to product-images" ON storage.objects;
CREATE POLICY "Give anon full access to product-images"
  on storage.objects
  for all
  to anon, authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

SELECT 'ĐÃ MỞ KHÓA TOÀN BỘ QUYỀN TRUY CẬP VÀ UPLOAD ÁNH THÀNH CÔNG!' as ket_qua;
