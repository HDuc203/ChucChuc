-- =====================================================
-- CHÚC CHÚC COFFEE - SETUP & UPDATE BANK ACCOUNT TO MB BANK
-- Chạy file này trong Supabase SQL Editor
-- =====================================================

-- 1. TẠO BẢNG BANK_SETTINGS NẾU CHƯA CÓ
create table if not exists bank_settings (
  id uuid primary key default gen_random_uuid(),
  bank_code text not null default 'mbbank',
  account_number text not null default '0964544341',
  account_name text not null default 'HUYNH THI THANH TRUC',
  template text not null default 'compact2',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. TẮT RLS CHO BẢNG BANK_SETTINGS
alter table bank_settings disable row level security;

-- 3. XÓA TÀI KHOẢN CŨ NẾU CÓ
delete from bank_settings;

-- 4. THÊM TÀI KHOẢN NGÂN HÀNG MỚI: MB BANK (HUYNH THI THANH TRUC)
insert into bank_settings (bank_code, account_number, account_name, template)
values ('mbbank', '0964544341', 'HUYNH THI THANH TRUC', 'compact2');

select 'ĐÃ TẠO BẢNG VÀ CẬP NHẬT TÀI KHOẢN NGÂN HÀNG MB BANK THÀNH CÔNG!' as ket_qua;
