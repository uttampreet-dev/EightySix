-- ============================================================
-- EightySix — Phase 7: seeded order history
-- Paste into the Supabase SQL Editor and Run. Safe to re-run.
--
-- Analytics, prep forecasting and top-dishes are only convincing with
-- history behind them. reset_demo now seeds ~35 paid orders across the
-- previous six days (IST lunch/dinner hours) with matching ledger rows.
-- Depletion triggers are suspended during seeding so live stock stays
-- exactly at seed values; unit_price still freezes per line.
-- ============================================================

create or replace function public.seed_order_history(rid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  d int; n int; i int; j int; items int; h int; q int;
  oid uuid; tid uuid; did uuid; ts timestamptz;
begin
  alter table public.order_items disable trigger trg_deplete_stock;
  alter table public.stock_events disable trigger trg_apply_stock_event;

  for d in 1..6 loop
    -- busier on weekends
    n := 4 + floor(random() * 3)::int
       + case when extract(dow from now() - make_interval(days => d)) in (0, 6) then 3 else 0 end;
    for i in 1..n loop
      select id into tid from public.tables
       where restaurant_id = rid order by random() limit 1;
      h := (array[12, 13, 13, 19, 20, 20, 21])[1 + floor(random() * 7)::int];
      -- an IST wall-clock hour on that day, expressed as an absolute instant
      ts := (date_trunc('day', (now() at time zone 'Asia/Kolkata'))
             - make_interval(days => d)
             + make_interval(hours => h, mins => floor(random() * 60)::int)
            ) at time zone 'Asia/Kolkata';

      insert into public.orders (restaurant_id, table_id, status, created_at)
      values (rid, tid, 'paid', ts)
      returning id into oid;

      items := 1 + floor(random() * 3)::int;
      for j in 1..items loop
        select id into did from public.dishes
         where restaurant_id = rid order by random() limit 1;
        q := 1 + floor(random() * 2)::int;
        insert into public.order_items (order_id, dish_id, qty, status, created_at)
        values (oid, did, q, 'ready', ts + make_interval(mins => j));
        -- matching usage history for prep_sheet(), without touching live stock
        insert into public.stock_events (restaurant_id, ingredient_id, delta, reason, created_at)
        select rid, r.ingredient_id, -(r.qty_per_portion * q), 'order', ts + make_interval(mins => j)
        from public.recipe_items r where r.dish_id = did;
      end loop;
    end loop;
  end loop;

  alter table public.order_items enable trigger trg_deplete_stock;
  alter table public.stock_events enable trigger trg_apply_stock_event;
end $$;

revoke execute on function public.seed_order_history(uuid) from public, anon, authenticated;

-- ---------- reset_demo: same restore as 006, then seed history ----------
create or replace function public.reset_demo()
returns void
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  select id into rid from public.restaurants where slug = 'demo';
  if rid is null then
    raise exception 'demo restaurant missing — run 001_init.sql first';
  end if;

  delete from public.orders where restaurant_id = rid; -- cascades order_items + feedback
  delete from public.stock_events where restaurant_id = rid;
  delete from public.reservations where restaurant_id = rid;
  delete from public.service_calls where restaurant_id = rid;
  update public.tables set status = 'free' where restaurant_id = rid;
  update public.dishes
     set is_active = true,
         price = coalesce(regular_price, price),
         regular_price = null,
         special_note = null,
         special_until = null
   where restaurant_id = rid;

  update public.ingredients i
     set stock_qty = s.qty
    from (values
      ('Paneer', 9), ('Chicken', 14), ('Mutton', 6), ('Basmati Rice', 25),
      ('Atta (Wheat Flour)', 20), ('Maida', 12), ('Butter', 5), ('Cream', 6),
      ('Curd', 10), ('Milk', 18), ('Ghee', 4), ('Cooking Oil', 15),
      ('Onions', 22), ('Tomatoes', 18), ('Ginger-Garlic Paste', 4),
      ('Green Chillies', 2), ('Fresh Coriander', 1.5), ('Mint', 1),
      ('Spinach', 6), ('Urad Dal (Black Lentils)', 8), ('Chickpeas', 7),
      ('Rajma', 5), ('Cauliflower', 6), ('Potatoes', 16), ('Garam Masala', 1.2),
      ('Tandoori Masala', 1.5), ('Kashmiri Chilli Powder', 1.2), ('Cumin', 1),
      ('Cashews', 3), ('Mango Pulp', 4), ('Sugar', 10), ('Tea Leaves', 1.5)
    ) as s(name, qty)
   where i.restaurant_id = rid and i.name = s.name;

  insert into public.profiles (id, restaurant_id, role)
  select u.id, rid,
    case
      when u.raw_user_meta_data->>'role' in ('owner','kitchen','waiter')
        then u.raw_user_meta_data->>'role'
      else 'owner'
    end
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id);

  perform public.seed_order_history(rid);
end $$;

revoke execute on function public.reset_demo() from public, anon, authenticated;

-- reseed now so the history appears immediately
select public.reset_demo();
