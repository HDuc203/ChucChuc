-- =====================================================
-- CHÚC CHÚC COFFEE - FIX RESTORE & CANCEL ORDER TRIGGER
-- Chạy file này trong Supabase SQL Editor để khắc phục lỗi Hủy/Khôi phục đơn
-- =====================================================

create or replace function check_order_status_transition()
returns trigger language plpgsql as $$
begin
  -- Cho phép hủy đơn và khôi phục đơn linh hoạt giữa 'open', 'paid', và 'cancelled'
  return new;
end;
$$;

drop trigger if exists trigger_check_order_status on orders;
create trigger trigger_check_order_status
before update on orders
for each row
execute function check_order_status_transition();

select 'ĐÃ CẬP NHẬT HỆ THỐNG! BÂY GIỜ BẠN CÓ THỂ HỦY VÀ KHÔI PHỤC ĐƠN HÀNG THOẢI MÁI.' as ket_qua;
