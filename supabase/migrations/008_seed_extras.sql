-- ============================================================
-- EightySix — Phase 8: richer reset seed
-- Paste into the Supabase SQL Editor and Run. Safe to re-run.
--
-- A fresh reset should read like a restaurant mid-day, not a blank
-- slate: a few paid orders from earlier today, tonight's bookings,
-- and diner ratings on past orders (real rows through real tables —
-- the AI feedback summary has genuine material to work with).
-- Kitchen queue and service calls stay empty on purpose: those are
-- the live-demo moments.
-- ============================================================

create or replace function public.seed_order_history(rid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  d int; n int; i int; j int; items int; h int; q int;
  oid uuid; tid uuid; did uuid; ts timestamptz;
  fb_order uuid;
  fb_ratings int[] := array[5, 4, 5, 3, 5, 4, 5, 4];
  fb_comments text[] := array[
    'Butter chicken was silky — best we''ve had in this part of town.',
    'Quick service even on a packed night. Naans kept coming hot.',
    'Loved that the menu showed what was actually available. No dead ends.',
    'Dal makhani was a touch salty for us, everything else was great.',
    'Paneer tikka came out smoky and perfect. Will be back.',
    'Biryani portion could be bigger, flavour was spot on though.',
    'The chef''s special was a steal. Kids loved the gulab jamun.',
    'Booked from the phone, table was ready when we walked in. Smooth.'
  ];
begin
  alter table public.order_items disable trigger trg_deplete_stock;
  alter table public.stock_events disable trigger trg_apply_stock_event;

  -- six days of history
  for d in 1..6 loop
    n := 4 + floor(random() * 3)::int
       + case when extract(dow from now() - make_interval(days => d)) in (0, 6) then 3 else 0 end;
    for i in 1..n loop
      select id into tid from public.tables
       where restaurant_id = rid order by random() limit 1;
      h := (array[12, 13, 13, 19, 20, 20, 21])[1 + floor(random() * 7)::int];
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
        insert into public.stock_events (restaurant_id, ingredient_id, delta, reason, created_at)
        select rid, r.ingredient_id, -(r.qty_per_portion * q), 'order', ts + make_interval(mins => j)
        from public.recipe_items r where r.dish_id = did;
      end loop;
    end loop;
  end loop;

  -- earlier today: a small settled lunch, so "today" is never ₹0.
  -- 40–110 minutes ago — old enough to stay off the live radar.
  for i in 1..4 loop
    select id into tid from public.tables
     where restaurant_id = rid order by random() limit 1;
    ts := now() - make_interval(mins => 40 + floor(random() * 70)::int);
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
      insert into public.stock_events (restaurant_id, ingredient_id, delta, reason, created_at)
      select rid, r.ingredient_id, -(r.qty_per_portion * q), 'order', ts + make_interval(mins => j)
      from public.recipe_items r where r.dish_id = did;
    end loop;
  end loop;

  alter table public.order_items enable trigger trg_deplete_stock;
  alter table public.stock_events enable trigger trg_apply_stock_event;

  -- tonight's bookings — always in the near future relative to the reset,
  -- so the reservations page and the waiter's "arriving soon" stay alive
  insert into public.reservations (restaurant_id, name, phone, party_size, reserved_at, status, note) values
    (rid, 'Ananya Sharma', '98100 12345', 2, now() + interval '90 minutes', 'booked', null),
    (rid, 'Rohan Mehta',   '98200 22334', 4, now() + interval '2 hours 15 minutes', 'booked', 'Window seat if possible'),
    (rid, 'Kabir Anand',   '99880 44556', 6, now() + interval '3 hours', 'booked', 'Birthday — kheer with a candle please');

  -- diner ratings on a sample of past orders (one per order, DB-enforced)
  j := 0;
  for fb_order in (
    select id from public.orders
     where restaurant_id = rid and status = 'paid' and created_at < now() - interval '12 hours'
     order by random() limit 8
  ) loop
    j := j + 1;
    insert into public.feedback (restaurant_id, order_id, rating, comment)
    values (rid, fb_order, fb_ratings[j], fb_comments[j]);
  end loop;
end $$;

revoke execute on function public.seed_order_history(uuid) from public, anon, authenticated;

-- reseed now with the richer state
select public.reset_demo();
