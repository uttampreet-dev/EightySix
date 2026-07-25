-- ============================================================
-- EightySix — Phase 4: demo-safe reset
-- Paste into the Supabase SQL Editor and Run. Safe to re-run.
--
-- The original reset_demo() dropped and re-created the restaurant row,
-- which cascaded away every profile pointing at it. This version keeps
-- restaurant / dish / ingredient ids stable: it clears order history,
-- restores seed stock, and re-creates any missing profiles.
-- ============================================================

create or replace function public.reset_demo()
returns void
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  select id into rid from public.restaurants where slug = 'demo';
  if rid is null then
    raise exception 'demo restaurant missing — run 001_init.sql first';
  end if;

  delete from public.orders where restaurant_id = rid; -- cascades order_items
  delete from public.stock_events where restaurant_id = rid;
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

  -- Self-heal: any auth user whose profile was lost to an old reset.
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

select public.reset_demo();
