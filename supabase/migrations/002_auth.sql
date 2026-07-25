-- ============================================================
-- EightySix — Phase 2: auth wiring
-- Paste into the Supabase SQL Editor and Run. Safe to re-run.
-- ============================================================

-- Every new auth user gets a profile at the demo restaurant.
-- Role comes from signup metadata; Google sign-ins default to owner.
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
      when new.raw_user_meta_data->>'role' in ('owner','kitchen')
        then new.raw_user_meta_data->>'role'
      else 'owner'
    end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Staff (owner/kitchen) may write within their own restaurant.
-- Server actions use the service role and bypass RLS; these policies
-- make the data model correct independent of that.
create or replace function public.my_restaurant_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select restaurant_id from public.profiles where id = auth.uid()
$$;

drop policy if exists "staff update" on public.ingredients;
create policy "staff update" on public.ingredients
  for update to authenticated
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

drop policy if exists "staff update" on public.dishes;
create policy "staff update" on public.dishes
  for update to authenticated
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

drop policy if exists "staff update" on public.orders;
create policy "staff update" on public.orders
  for update to authenticated
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

drop policy if exists "staff update" on public.tables;
create policy "staff update" on public.tables
  for update to authenticated
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

drop policy if exists "staff update" on public.order_items;
create policy "staff update" on public.order_items
  for update to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.restaurant_id = public.my_restaurant_id()
  ));

-- The BEFORE trigger fills restaurant_id, so WITH CHECK sees the final row.
drop policy if exists "staff insert stock events" on public.stock_events;
create policy "staff insert stock events" on public.stock_events
  for insert to authenticated
  with check (restaurant_id = public.my_restaurant_id());
