-- =====================================================
-- BẢNG CÀI ĐẶT NGÂN HÀNG VIETQR CHÚC CHÚC
-- =====================================================

create table if not exists bank_settings (
  id uuid primary key default gen_random_uuid(),
  bank_code text not null default 'vietcombank',
  account_number text not null default '1019500502',
  account_name text not null default 'TRINH HOANG DUC',
  template text not null default 'compact2',
  updated_at timestamptz default now()
);

-- Tắt RLS để thao tác trực tiếp
alter table bank_settings disable row level security;

-- Đặt mặc định tài khoản Vietcombank TRINH HOANG DUC 1019500502
delete from bank_settings;
insert into bank_settings (bank_code, account_number, account_name, template)
values ('vietcombank', '1019500502', 'TRINH HOANG DUC', 'compact2');

select 'Cấu hình Ngân hàng VietQR thành công!' as ket_qua;
