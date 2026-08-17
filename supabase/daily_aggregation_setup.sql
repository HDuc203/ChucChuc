-- ============================================================================
-- CHÚC CHÚC COFFEE - 7-DAY RETENTION & PERMANENT AGGREGATION SYSTEM
-- Chạy toàn bộ file này trong Supabase SQL Editor
-- ============================================================================

-- 1. TẠO BẢNG TỔNG HỢP DOANH THU & CHI PHÍ THEO NGÀY (LƯU VĨNH VIỄN)
create table if not exists daily_summaries (
  day date primary key,
  total_revenue numeric(12,0) not null default 0,
  total_orders integer not null default 0,
  cash_revenue numeric(12,0) not null default 0,
  transfer_revenue numeric(12,0) not null default 0,
  takeaway_revenue numeric(12,0) not null default 0,
  dine_in_revenue numeric(12,0) not null default 0,
  total_expense numeric(12,0) not null default 0,
  net_profit numeric(12,0) not null default 0,
  updated_at timestamptz default now()
);

-- Tắt RLS & Cấp quyền đầy đủ
alter table daily_summaries disable row level security;
grant all on table daily_summaries to anon, authenticated, postgres, service_role;

-- 2. HÀM ĐỒNG BỘ DỮ LIỆU TỪNG NGÀY VÀO DAILY_SUMMARIES (UPSERT)
create or replace function sync_daily_summary_for_date(target_date date)
returns void
language plpgsql as $$
declare
  v_rev numeric(12,0) := 0;
  v_orders int := 0;
  v_cash numeric(12,0) := 0;
  v_transfer numeric(12,0) := 0;
  v_takeaway numeric(12,0) := 0;
  v_dine_in numeric(12,0) := 0;
  v_exp numeric(12,0) := 0;
begin
  -- Tính tổng từ orders của ngày target_date
  select 
    coalesce(sum(total_amount), 0),
    count(*),
    coalesce(sum(case when payment_method = 'cash' then total_amount else 0 end), 0),
    coalesce(sum(case when payment_method in ('transfer', 'qr') then total_amount else 0 end), 0),
    coalesce(sum(case when order_type = 'takeaway' then total_amount else 0 end), 0),
    coalesce(sum(case when order_type = 'dine_in' then total_amount else 0 end), 0)
  into v_rev, v_orders, v_cash, v_transfer, v_takeaway, v_dine_in
  from orders
  where status = 'paid' and date(paid_at) = target_date;

  -- Tính tổng chi phí từ expenses của ngày target_date
  select coalesce(sum(amount), 0)
  into v_exp
  from expenses
  where expense_date = target_date;

  -- Nếu ngày đó có doanh thu hoặc chi phí, lưu/cập nhật vào daily_summaries
  if v_orders > 0 or v_exp > 0 then
    insert into daily_summaries (
      day, total_revenue, total_orders, cash_revenue, transfer_revenue, 
      takeaway_revenue, dine_in_revenue, total_expense, net_profit, updated_at
    ) values (
      target_date, v_rev, v_orders, v_cash, v_transfer, 
      v_takeaway, v_dine_in, v_exp, (v_rev - v_exp), now()
    )
    on conflict (day) do update set
      total_revenue = excluded.total_revenue,
      total_orders = excluded.total_orders,
      cash_revenue = excluded.cash_revenue,
      transfer_revenue = excluded.transfer_revenue,
      takeaway_revenue = excluded.takeaway_revenue,
      dine_in_revenue = excluded.dine_in_revenue,
      total_expense = excluded.total_expense,
      net_profit = excluded.net_profit,
      updated_at = now();
  end if;
end;
$$;

-- 3. NẠP TOÀN BỘ DỮ LIỆU LỊCH SỬ CŨ VÀO DAILY_SUMMARIES (BACKFILL)
do $$
declare
  r record;
begin
  for r in (
    select distinct date(paid_at) as d from orders where status = 'paid' and paid_at is not null
    union
    select distinct expense_date as d from expenses
  ) loop
    perform sync_daily_summary_for_date(r.d);
  end loop;
end;
$$;

-- 4. TRIGGER TỰ ĐỘNG CẬP NHẬT DAILY_SUMMARIES KHI CÓ ĐƠN THANH TOÁN HOẶC THÊM CHI PHÍ
create or replace function trg_sync_order_to_daily_summary()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') and new.status = 'paid' and new.paid_at is not null then
    perform sync_daily_summary_for_date(date(new.paid_at));
  end if;
  if tg_op = 'UPDATE' and old.status = 'paid' and old.paid_at is not null and date(old.paid_at) <> date(new.paid_at) then
    perform sync_daily_summary_for_date(date(old.paid_at));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_sync_daily on orders;
create trigger trg_orders_sync_daily
after insert or update on orders
for each row execute function trg_sync_order_to_daily_summary();

create or replace function trg_sync_expense_to_daily_summary()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    perform sync_daily_summary_for_date(new.expense_date);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.expense_date <> new.expense_date) then
    perform sync_daily_summary_for_date(old.expense_date);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_expenses_sync_daily on expenses;
create trigger trg_expenses_sync_daily
after insert or update or delete on expenses
for each row execute function trg_sync_expense_to_daily_summary();

-- 5. HÀM TỰ ĐỘNG DỌN DẸP ĐƠN CŨ HƠN 7 NGÀY (CLEANUP OLD ORDERS)
create or replace function cleanup_old_orders(retention_days int default 7)
returns table(deleted_orders_count bigint, deleted_items_count bigint)
language plpgsql as $$
declare
  v_cutoff_date date := current_date - (retention_days || ' days')::interval;
  v_deleted_orders bigint := 0;
  v_deleted_items bigint := 0;
  r record;
begin
  -- 1. Đảm bảo tất cả các ngày trước khi xóa đã được đồng bộ vào daily_summaries
  for r in (
    select distinct date(paid_at) as d 
    from orders 
    where status = 'paid' and date(paid_at) < v_cutoff_date
  ) loop
    perform sync_daily_summary_for_date(r.d);
  end loop;

  -- 2. Xóa các order_items của đơn cũ hơn retention_days
  with deleted_i as (
    delete from order_items
    where order_id in (
      select id from orders
      where date(created_at) < v_cutoff_date
        and status in ('paid', 'cancelled')
    )
    returning id
  )
  select count(*) into v_deleted_items from deleted_i;

  -- 3. Xóa các orders cũ hơn retention_days
  with deleted_o as (
    delete from orders
    where date(created_at) < v_cutoff_date
      and status in ('paid', 'cancelled')
    returning id
  )
  select count(*) into v_deleted_orders from deleted_o;

  return query select v_deleted_orders, v_deleted_items;
end;
$$;

grant execute on function cleanup_old_orders(int) to anon, authenticated, postgres, service_role;
grant execute on function sync_daily_summary_for_date(date) to anon, authenticated, postgres, service_role;

-- 6. CẬP NHẬT CÁC HÀM BÁO CÁO THÁNG & NĂM ĐỌC TỪ BẢNG VĨNH VIỄN DAILY_SUMMARIES
create or replace function revenue_by_year(target_year int)
returns table(month int, revenue numeric, order_count bigint)
language sql as $$
  select 
    extract(month from day)::int as month,
    sum(total_revenue) as revenue,
    sum(total_orders)::bigint as order_count
  from daily_summaries
  where extract(year from day) = target_year
  group by extract(month from day)
  order by month;
$$;

create or replace function revenue_detail_by_month(target_year int, target_month int)
returns table(day int, revenue numeric, order_count bigint)
language sql as $$
  select 
    extract(day from day)::int as day,
    total_revenue as revenue,
    total_orders::bigint as order_count
  from daily_summaries
  where extract(year from day) = target_year
    and extract(month from day) = target_month
  order by day;
$$;

create or replace view profit_by_month as
select 
  date_trunc('month', day) as month,
  sum(total_revenue) as revenue,
  sum(total_expense) as expense,
  sum(net_profit) as profit
from daily_summaries
group by date_trunc('month', day)
order by month desc;

grant execute on function revenue_by_year(int) to anon, authenticated;
grant execute on function revenue_detail_by_month(int, int) to anon, authenticated;
grant select on profit_by_month to anon, authenticated;

select 'HỆ THỐNG LƯU TRỮ 7 NGÀY & TỔNG HỢP DOANH THU VĨNH VIỄN ĐÃ SẴN SÀNG!' as ket_qua;
