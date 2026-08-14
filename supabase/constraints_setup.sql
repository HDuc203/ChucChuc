-- =====================================================
-- CHÚC CHÚC COFFEE - BUSINESS CONSTRAINTS & TRIGGERS (DB LAYER)
-- Chạy file này trong Supabase SQL Editor
-- =====================================================

-- 1. RÀNG BUỘC SỐ LƯỢNG MÓN VÀ GIÁ SẢN PHẨM > 0
alter table order_items drop constraint if exists check_order_items_quantity_positive;
alter table order_items add constraint check_order_items_quantity_positive check (quantity > 0);

alter table products drop constraint if exists check_products_price_positive;
alter table products add constraint check_products_price_positive check (price > 0);

-- 2. TỰ ĐỘNG DỌN DẸP MÓN TRÙNG TÊN CŨ (GIỮ LẠI MÓN MỚI NHẤT, ĐÁNH DẤU XÓA CÁC MÓN TRÙNG CŨ)
with duplicates as (
  select id,
         row_number() over (
           partition by category_id, lower(name) 
           order by created_at desc, id desc
         ) as rnum
  from products
  where is_deleted = false
)
update products
set is_deleted = true
where id in (
  select id from duplicates where rnum > 1
);

-- 3. TẠO UNIQUE INDEX: TÊN MÓN KHÔNG ĐƯỢC TRÙNG TRONG CÙNG DANH MỤC (VỚI CÁC MÓN CHƯA XÓA)
drop index if exists unique_product_name_per_category;
create unique index unique_product_name_per_category
on products (category_id, lower(name))
where is_deleted = false;

-- 4. RÀNG BUỘC CHUYỂN TRẠNG THÁI ĐƠN HÀNG (ORDER STATUS TRANSITIONS)
-- Cho phép hủy đơn và khôi phục đơn linh hoạt giữa các trạng thái ('open', 'paid', 'cancelled')
create or replace function check_order_status_transition()
returns trigger language plpgsql as $$
begin
  return new;
end;
$$;

drop trigger if exists trigger_check_order_status on orders;
create trigger trigger_check_order_status
before update on orders
for each row
execute function check_order_status_transition();

-- 5. RÀNG BUỘC BÀN: KHÔNG CHO GIẢI PHÓNG BÀN (SET STATUS = 'empty') NẾU CÒN ĐƠN 'open'
create or replace function check_table_free_with_open_orders()
returns trigger language plpgsql as $$
declare
  open_order_count int;
begin
  if new.status = 'empty' then
    select count(*) into open_order_count
    from orders
    where table_id = new.id and status = 'open';

    if open_order_count > 0 then
      raise exception 'Không thể chuyển bàn về trạng thái trống khi vẫn còn đơn hàng chưa thanh toán.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_check_table_free on tables;
create trigger trigger_check_table_free
before update on tables
for each row
execute function check_table_free_with_open_orders();

select 'ĐÃ THIẾT LẬP TOÀN BỘ RÀNG BUỘC DB VÀ DỌN DẸP MÓN TRÙNG THÀNH CÔNG!' as ket_qua;
