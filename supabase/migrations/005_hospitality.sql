-- ============================================================
-- EightySix — Phase 5: reservations + feedback
-- Paste into the Supabase SQL Editor and Run. Safe to re-run.
-- ============================================================

drop table if exists public.reservations cascade;
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  phone text not null,
  party_size int not null check (party_size > 0 and party_size <= 20),
  reserved_at timestamptz not null,
  table_id uuid references public.tables(id) on delete set null,
  status text not null default 'booked'
    check (status in ('booked','seated','completed','cancelled')),
  note text,
  created_at timestamptz not null default now()
);
create index idx_reservations_restaurant_time
  on public.reservations (restaurant_id, reserved_at);

drop table if exists public.feedback cascade;
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (order_id)
);
create index idx_feedback_restaurant_created
  on public.feedback (restaurant_id, created_at desc);

alter table public.reservations enable row level security;
alter table public.feedback enable row level security;

-- Same model as everything else: public read, writes via server actions.
create policy "public read" on public.reservations for select using (true);
create policy "public read" on public.feedback for select using (true);

drop policy if exists "staff update" on public.reservations;
create policy "staff update" on public.reservations
  for update to authenticated
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

alter publication supabase_realtime add table
  public.reservations, public.feedback;

-- reset_demo also clears hospitality data now
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
  update public.tables set status = 'free' where restaurant_id = rid;
  update public.dishes set is_active = true where restaurant_id = rid;

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
      when u.raw_user_meta_data->>'role' in ('owner','kitchen')
        then u.raw_user_meta_data->>'role'
      else 'owner'
    end
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id);
end $$;

revoke execute on function public.reset_demo() from public, anon, authenticated;
