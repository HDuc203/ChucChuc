-- =====================================================
-- CHÚC CHÚC COFFEE - UPDATE TO 10 TABLES
-- Chạy file này trong Supabase SQL Editor để tăng lên 10 bàn
-- =====================================================

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
  ('c1d2e3f4-0010-0010-0010-000000000010', 'Bàn 10', 'empty')
on conflict (id) do update set name = excluded.name;

select 'ĐÃ TĂNG LÊN THÀNH 10 BÀN THÀNH CÔNG!' as ket_qua;
