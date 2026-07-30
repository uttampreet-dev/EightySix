-- ============================================================
-- EightySix — Phase 6: waiter surface, service calls, chef's specials
-- Paste into the Supabase SQL Editor and Run. Safe to re-run.
-- ============================================================

-- ---------- waiter role ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('owner','kitchen','waiter'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  select id into rid from public.restaurants where slug = 'demo';
  insert into public.profiles (id, restaurant_id, role)
  values (
    new.id,
    rid,
    case
      when new.raw_user_meta_data->>'role' in ('owner','kitchen','waiter')
        then new.raw_user_meta_data->>'role'
      else 'owner'
    end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------- service calls (diner → floor staff) ----------
drop table if exists public.service_calls cascade;
create table public.service_calls (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  kind text not null check (kind in ('waiter','bill')),
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now()
);
create index idx_service_calls_restaurant_status
  on public.service_calls (restaurant_id, status, created_at desc);

alter table public.service_calls enable row level security;
create policy "public read" on public.service_calls for select using (true);

drop policy if exists "staff update" on public.service_calls;
create policy "staff update" on public.service_calls
  for update to authenticated
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

-- ---------- price snapshots ----------
-- Bills and analytics must not rewrite history when a price changes
-- (specials change prices live). Each order line freezes its unit price
-- at insert; old rows fall back to the current dish price.
alter table public.order_items add column if not exists unit_price numeric;

create or replace function public.fill_order_item_price()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.unit_price is null then
    select price into new.unit_price from public.dishes where id = new.dish_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_fill_order_item_price on public.order_items;
create trigger trg_fill_order_item_price
before insert on public.order_items
for each row execute function public.fill_order_item_price();

-- ---------- chef's specials (surplus intervention) ----------
-- The discounted value becomes the real price so orders, bills, GST and
-- analytics stay correct with zero parallel price math. regular_price
-- holds the original for display and restore; non-null = special active.
alter table public.dishes add column if not exists regular_price numeric;
alter table public.dishes add column if not exists special_note text;
alter table public.dishes add column if not exists special_until timestamptz;

-- recreate both views to expose the special columns
drop view if exists public.dish_risk;
drop view if exists public.dish_availability;

create view public.dish_availability
with (security_invoker = on) as
select
  d.id,
  d.restaurant_id,
  d.name,
  d.price,
  d.regular_price,
  d.special_note,
  d.special_until,
  d.category,
  d.veg,
  d.img,
  d.is_active,
  -- greatest(0,…): a concurrent-order race can momentarily imply negative
  -- portions; the menu should never print a negative number.
  coalesce(greatest(floor(min(i.stock_qty / r.qty_per_portion)), 0)::int, 0) as portions_left
from public.dishes d
left join public.recipe_items r on r.dish_id = d.id
left join public.ingredients i on i.id = r.ingredient_id
group by d.id;

create view public.dish_risk
with (security_invoker = on) as
select
  a.id,
  a.restaurant_id,
  a.name,
  a.price,
  a.regular_price,
  a.special_note,
  a.special_until,
  a.category,
  a.veg,
  a.img,
  a.is_active,
  a.portions_left,
  coalesce(v.portions_30min, 0)::int as velocity_30min,
  case
    when a.portions_left <= 0 then 0
    when coalesce(v.portions_30min, 0) = 0 then null
    -- greatest(1,…): a fast-selling last portion rounds to 0, which is the
    -- "already dead" sentinel — it must stay on the radar as ~1 minute.
    else greatest(1, round(a.portions_left::numeric * 30 / v.portions_30min))::int
  end as minutes_to_86
from public.dish_availability a
left join (
  select oi.dish_id, sum(oi.qty) as portions_30min
  from public.order_items oi
  where oi.created_at > now() - interval '30 minutes'
  group by oi.dish_id
) v on v.dish_id = a.id;

-- ---------- surplus view (the other end of the radar) ----------
-- Scarcity kills dishes; surplus quietly kills margin. This view pairs
-- live stock with trailing 24h order usage so the console can spot
-- ingredients heading for waste and act on them.
drop view if exists public.ingredient_surplus;
create view public.ingredient_surplus
with (security_invoker = on) as
select
  i.id,
  i.restaurant_id,
  i.name,
  i.unit,
  i.stock_qty,
  i.reorder_level,
  i.cost_per_unit,
  round(coalesce(u.used, 0)::numeric, 2) as used_24h,
  case
    when coalesce(u.used, 0) <= 0 then null
    else round((i.stock_qty / u.used)::numeric, 1)
  end as days_of_cover
from public.ingredients i
left join (
  select ingredient_id, -sum(delta) as used
  from public.stock_events
  where reason = 'order' and created_at > now() - interval '24 hours'
  group by 1
) u on u.ingredient_id = i.id;

-- ---------- realtime ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'service_calls'
  ) then
    alter publication supabase_realtime add table public.service_calls;
  end if;
end $$;

-- ---------- reset_demo: clear calls, end specials, accept waiter ----------
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
end $$;

revoke execute on function public.reset_demo() from public, anon, authenticated;
