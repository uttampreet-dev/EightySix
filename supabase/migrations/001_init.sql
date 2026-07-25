-- ============================================================
-- EightySix — Phase 1: schema, RLS, engine triggers, seed
-- Paste this whole file into the Supabase SQL Editor and Run.
-- Safe to re-run: it drops and recreates everything it owns.
-- ============================================================

-- ---------- drop (idempotent re-runs) ----------
drop view if exists public.dish_availability;
drop table if exists public.stock_events cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.tables cascade;
drop table if exists public.recipe_items cascade;
drop table if exists public.dishes cascade;
drop table if exists public.ingredients cascade;
drop table if exists public.profiles cascade;
drop table if exists public.restaurants cascade;
drop function if exists public.reset_demo();
drop function if exists public.apply_stock_event();
drop function if exists public.deplete_stock_for_order_item();
drop function if exists public.fill_stock_event_restaurant();

-- ---------- tables ----------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tagline text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  role text not null check (role in ('owner','kitchen')),
  created_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  unit text not null,
  stock_qty numeric not null default 0,
  reorder_level numeric not null default 0,
  cost_per_unit numeric not null default 0,
  unique (restaurant_id, name)
);

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  price numeric not null,
  category text not null,
  veg boolean not null default true,
  img text,
  is_active boolean not null default true,
  unique (restaurant_id, name)
);

create table public.recipe_items (
  dish_id uuid not null references public.dishes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  qty_per_portion numeric not null check (qty_per_portion > 0),
  primary key (dish_id, ingredient_id)
);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  label text not null,
  seats int not null default 4,
  status text not null default 'free' check (status in ('free','occupied')),
  unique (restaurant_id, label)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null,
  status text not null default 'placed' check (status in ('placed','cooking','served','paid')),
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete cascade,
  qty int not null check (qty > 0),
  status text not null default 'queued' check (status in ('queued','ready')),
  created_at timestamptz not null default now()
);

create table public.stock_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  delta numeric not null,
  reason text not null check (reason in ('order','manual','prep')),
  created_at timestamptz not null default now()
);

create index idx_orders_restaurant_created on public.orders (restaurant_id, created_at desc);
create index idx_order_items_order on public.order_items (order_id);
create index idx_order_items_dish_created on public.order_items (dish_id, created_at desc);
create index idx_stock_events_ingredient_created on public.stock_events (ingredient_id, created_at desc);
create index idx_stock_events_restaurant_created on public.stock_events (restaurant_id, created_at desc);

-- ---------- engine triggers ----------
-- Every stock change flows through stock_events; this ledger is the
-- single source of truth. The trigger folds each event into stock_qty.

create function public.fill_stock_event_restaurant()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.restaurant_id is null then
    select restaurant_id into new.restaurant_id
    from public.ingredients where id = new.ingredient_id;
  end if;
  return new;
end $$;

create trigger trg_fill_stock_event_restaurant
before insert on public.stock_events
for each row execute function public.fill_stock_event_restaurant();

create function public.apply_stock_event()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.ingredients
     set stock_qty = greatest(0, stock_qty + new.delta)
   where id = new.ingredient_id;
  return new;
end $$;

create trigger trg_apply_stock_event
after insert on public.stock_events
for each row execute function public.apply_stock_event();

-- Ordering a dish depletes every ingredient in its recipe.
create function public.deplete_stock_for_order_item()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.stock_events (ingredient_id, delta, reason)
  select r.ingredient_id, -(r.qty_per_portion * new.qty), 'order'
  from public.recipe_items r
  where r.dish_id = new.dish_id;
  return new;
end $$;

create trigger trg_deplete_stock
after insert on public.order_items
for each row execute function public.deplete_stock_for_order_item();

-- ---------- availability view ----------
-- portions_left = floor(min over recipe of stock / qty_per_portion)
create view public.dish_availability
with (security_invoker = on) as
select
  d.id,
  d.restaurant_id,
  d.name,
  d.price,
  d.category,
  d.veg,
  d.img,
  d.is_active,
  coalesce(floor(min(i.stock_qty / r.qty_per_portion))::int, 0) as portions_left
from public.dishes d
left join public.recipe_items r on r.dish_id = d.id
left join public.ingredients i on i.id = r.ingredient_id
group by d.id;

-- ---------- RLS ----------
alter table public.restaurants  enable row level security;
alter table public.profiles     enable row level security;
alter table public.ingredients  enable row level security;
alter table public.dishes       enable row level security;
alter table public.recipe_items enable row level security;
alter table public.tables       enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.stock_events enable row level security;

-- Diners browse without accounts; menu, availability and live updates
-- are public reads. All writes go through the server (service role).
create policy "public read" on public.restaurants  for select using (true);
create policy "public read" on public.ingredients  for select using (true);
create policy "public read" on public.dishes       for select using (true);
create policy "public read" on public.recipe_items for select using (true);
create policy "public read" on public.tables       for select using (true);
create policy "public read" on public.orders       for select using (true);
create policy "public read" on public.order_items  for select using (true);
create policy "public read" on public.stock_events for select using (true);

create policy "own profile" on public.profiles for select using (id = auth.uid());

-- ---------- realtime ----------
alter publication supabase_realtime add table
  public.stock_events, public.orders, public.order_items,
  public.ingredients, public.dishes, public.tables;

-- ---------- demo seed ----------
create function public.reset_demo()
returns void
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  delete from public.restaurants where slug = 'demo';

  insert into public.restaurants (name, slug, tagline)
  values ('Tandoor Tales', 'demo', 'North Indian kitchen · New Delhi')
  returning id into rid;

  insert into public.ingredients (restaurant_id, name, unit, stock_qty, reorder_level, cost_per_unit) values
    (rid,'Paneer','kg',9,2,320),
    (rid,'Chicken','kg',14,3,220),
    (rid,'Mutton','kg',6,2,650),
    (rid,'Basmati Rice','kg',25,5,140),
    (rid,'Atta (Wheat Flour)','kg',20,4,45),
    (rid,'Maida','kg',12,3,40),
    (rid,'Butter','kg',5,1.5,480),
    (rid,'Cream','L',6,1.5,240),
    (rid,'Curd','kg',10,2,80),
    (rid,'Milk','L',18,4,60),
    (rid,'Ghee','kg',4,1,600),
    (rid,'Cooking Oil','L',15,3,130),
    (rid,'Onions','kg',22,5,35),
    (rid,'Tomatoes','kg',18,4,40),
    (rid,'Ginger-Garlic Paste','kg',4,1,180),
    (rid,'Green Chillies','kg',2,0.5,90),
    (rid,'Fresh Coriander','kg',1.5,0.4,120),
    (rid,'Mint','kg',1,0.3,110),
    (rid,'Spinach','kg',6,1.5,50),
    (rid,'Urad Dal (Black Lentils)','kg',8,2,150),
    (rid,'Chickpeas','kg',7,2,120),
    (rid,'Rajma','kg',5,1.5,160),
    (rid,'Cauliflower','kg',6,1.5,55),
    (rid,'Potatoes','kg',16,4,30),
    (rid,'Garam Masala','kg',1.2,0.3,900),
    (rid,'Tandoori Masala','kg',1.5,0.4,850),
    (rid,'Kashmiri Chilli Powder','kg',1.2,0.3,700),
    (rid,'Cumin','kg',1,0.25,500),
    (rid,'Cashews','kg',3,0.8,900),
    (rid,'Mango Pulp','kg',4,1,180),
    (rid,'Sugar','kg',10,2,45),
    (rid,'Tea Leaves','kg',1.5,0.4,400);

  insert into public.dishes (restaurant_id, name, price, category, veg) values
    (rid,'Paneer Tikka',285,'Tandoor & Starters',true),
    (rid,'Hara Bhara Kebab',235,'Tandoor & Starters',true),
    (rid,'Tandoori Chicken (Half)',345,'Tandoor & Starters',false),
    (rid,'Chicken Malai Tikka',325,'Tandoor & Starters',false),
    (rid,'Mutton Seekh Kebab',365,'Tandoor & Starters',false),
    (rid,'Butter Paneer',295,'Curries',true),
    (rid,'Dal Makhani',245,'Curries',true),
    (rid,'Palak Paneer',275,'Curries',true),
    (rid,'Kadhai Paneer',285,'Curries',true),
    (rid,'Chana Masala',225,'Curries',true),
    (rid,'Rajma Masala',225,'Curries',true),
    (rid,'Aloo Gobi',215,'Curries',true),
    (rid,'Butter Chicken',335,'Curries',false),
    (rid,'Chicken Tikka Masala',345,'Curries',false),
    (rid,'Mutton Rogan Josh',395,'Curries',false),
    (rid,'Butter Naan',55,'Breads',true),
    (rid,'Garlic Naan',65,'Breads',true),
    (rid,'Tandoori Roti',35,'Breads',true),
    (rid,'Laccha Paratha',60,'Breads',true),
    (rid,'Steamed Basmati Rice',145,'Rice & Biryani',true),
    (rid,'Jeera Rice',165,'Rice & Biryani',true),
    (rid,'Veg Biryani',255,'Rice & Biryani',true),
    (rid,'Chicken Biryani',315,'Rice & Biryani',false),
    (rid,'Sweet Lassi',95,'Beverages & Desserts',true),
    (rid,'Mango Lassi',125,'Beverages & Desserts',true),
    (rid,'Masala Chai',60,'Beverages & Desserts',true),
    (rid,'Gulab Jamun',115,'Beverages & Desserts',true),
    (rid,'Kheer',125,'Beverages & Desserts',true);

  insert into public.recipe_items (dish_id, ingredient_id, qty_per_portion)
  select d.id, i.id, x.qty::numeric
  from (values
    ('Paneer Tikka','Paneer',0.18),
    ('Paneer Tikka','Curd',0.05),
    ('Paneer Tikka','Tandoori Masala',0.008),
    ('Paneer Tikka','Cooking Oil',0.02),
    ('Hara Bhara Kebab','Spinach',0.12),
    ('Hara Bhara Kebab','Potatoes',0.1),
    ('Hara Bhara Kebab','Green Chillies',0.005),
    ('Hara Bhara Kebab','Cooking Oil',0.03),
    ('Tandoori Chicken (Half)','Chicken',0.45),
    ('Tandoori Chicken (Half)','Curd',0.06),
    ('Tandoori Chicken (Half)','Tandoori Masala',0.012),
    ('Tandoori Chicken (Half)','Kashmiri Chilli Powder',0.005),
    ('Chicken Malai Tikka','Chicken',0.22),
    ('Chicken Malai Tikka','Cream',0.04),
    ('Chicken Malai Tikka','Cashews',0.015),
    ('Mutton Seekh Kebab','Mutton',0.2),
    ('Mutton Seekh Kebab','Onions',0.04),
    ('Mutton Seekh Kebab','Garam Masala',0.006),
    ('Butter Paneer','Paneer',0.2),
    ('Butter Paneer','Butter',0.03),
    ('Butter Paneer','Cream',0.05),
    ('Butter Paneer','Tomatoes',0.15),
    ('Butter Paneer','Cashews',0.02),
    ('Butter Paneer','Kashmiri Chilli Powder',0.004),
    ('Dal Makhani','Urad Dal (Black Lentils)',0.12),
    ('Dal Makhani','Butter',0.025),
    ('Dal Makhani','Cream',0.04),
    ('Dal Makhani','Tomatoes',0.06),
    ('Dal Makhani','Ginger-Garlic Paste',0.008),
    ('Palak Paneer','Spinach',0.25),
    ('Palak Paneer','Paneer',0.15),
    ('Palak Paneer','Cream',0.02),
    ('Palak Paneer','Onions',0.05),
    ('Kadhai Paneer','Paneer',0.18),
    ('Kadhai Paneer','Onions',0.08),
    ('Kadhai Paneer','Tomatoes',0.08),
    ('Kadhai Paneer','Garam Masala',0.006),
    ('Chana Masala','Chickpeas',0.15),
    ('Chana Masala','Onions',0.08),
    ('Chana Masala','Tomatoes',0.08),
    ('Chana Masala','Cumin',0.004),
    ('Rajma Masala','Rajma',0.15),
    ('Rajma Masala','Onions',0.08),
    ('Rajma Masala','Tomatoes',0.08),
    ('Aloo Gobi','Potatoes',0.15),
    ('Aloo Gobi','Cauliflower',0.2),
    ('Aloo Gobi','Cumin',0.004),
    ('Aloo Gobi','Cooking Oil',0.03),
    ('Butter Chicken','Chicken',0.25),
    ('Butter Chicken','Butter',0.03),
    ('Butter Chicken','Cream',0.05),
    ('Butter Chicken','Tomatoes',0.15),
    ('Butter Chicken','Cashews',0.015),
    ('Chicken Tikka Masala','Chicken',0.25),
    ('Chicken Tikka Masala','Onions',0.08),
    ('Chicken Tikka Masala','Tomatoes',0.12),
    ('Chicken Tikka Masala','Cream',0.03),
    ('Mutton Rogan Josh','Mutton',0.3),
    ('Mutton Rogan Josh','Onions',0.1),
    ('Mutton Rogan Josh','Curd',0.05),
    ('Mutton Rogan Josh','Kashmiri Chilli Powder',0.006),
    ('Butter Naan','Maida',0.1),
    ('Butter Naan','Butter',0.015),
    ('Butter Naan','Milk',0.02),
    ('Garlic Naan','Maida',0.1),
    ('Garlic Naan','Butter',0.015),
    ('Garlic Naan','Ginger-Garlic Paste',0.01),
    ('Tandoori Roti','Atta (Wheat Flour)',0.09),
    ('Laccha Paratha','Atta (Wheat Flour)',0.1),
    ('Laccha Paratha','Ghee',0.02),
    ('Steamed Basmati Rice','Basmati Rice',0.15),
    ('Jeera Rice','Basmati Rice',0.15),
    ('Jeera Rice','Cumin',0.005),
    ('Jeera Rice','Ghee',0.015),
    ('Veg Biryani','Basmati Rice',0.2),
    ('Veg Biryani','Cauliflower',0.08),
    ('Veg Biryani','Potatoes',0.08),
    ('Veg Biryani','Curd',0.04),
    ('Veg Biryani','Garam Masala',0.006),
    ('Chicken Biryani','Basmati Rice',0.2),
    ('Chicken Biryani','Chicken',0.25),
    ('Chicken Biryani','Curd',0.05),
    ('Chicken Biryani','Garam Masala',0.008),
    ('Sweet Lassi','Curd',0.2),
    ('Sweet Lassi','Sugar',0.03),
    ('Mango Lassi','Curd',0.18),
    ('Mango Lassi','Mango Pulp',0.08),
    ('Mango Lassi','Sugar',0.02),
    ('Masala Chai','Milk',0.12),
    ('Masala Chai','Tea Leaves',0.008),
    ('Masala Chai','Sugar',0.015),
    ('Gulab Jamun','Milk',0.1),
    ('Gulab Jamun','Maida',0.03),
    ('Gulab Jamun','Sugar',0.06),
    ('Gulab Jamun','Ghee',0.03),
    ('Kheer','Milk',0.25),
    ('Kheer','Basmati Rice',0.03),
    ('Kheer','Sugar',0.03),
    ('Kheer','Cashews',0.008)
  ) as x(dish, ing, qty)
  join public.dishes d on d.restaurant_id = rid and d.name = x.dish
  join public.ingredients i on i.restaurant_id = rid and i.name = x.ing;

  insert into public.tables (restaurant_id, label, seats) values
    (rid,'T1',2),(rid,'T2',2),(rid,'T3',4),(rid,'T4',4),(rid,'T5',4),
    (rid,'T6',6),(rid,'T7',6),(rid,'T8',2),(rid,'T9',4),(rid,'T10',8);
end $$;

revoke execute on function public.reset_demo() from public, anon, authenticated;

select public.reset_demo();
