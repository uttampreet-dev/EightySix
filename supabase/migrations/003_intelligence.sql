-- ============================================================
-- EightySix — Phase 3: predictive engine
-- Paste into the Supabase SQL Editor and Run. Safe to re-run.
-- ============================================================

-- ---------- 86-risk view ----------
-- velocity_30min: portions of this dish ordered in the trailing 30 minutes.
-- minutes_to_86:  portions_left / (velocity per minute). NULL = no current
-- velocity (not dying); 0 = already dead. All from real order timestamps.
drop view if exists public.dish_risk;
create view public.dish_risk
with (security_invoker = on) as
select
  a.id,
  a.restaurant_id,
  a.name,
  a.price,
  a.category,
  a.veg,
  a.img,
  a.is_active,
  a.portions_left,
  coalesce(v.portions_30min, 0)::int as velocity_30min,
  case
    when a.portions_left <= 0 then 0
    when coalesce(v.portions_30min, 0) = 0 then null
    else round(a.portions_left::numeric * 30 / v.portions_30min)::int
  end as minutes_to_86
from public.dish_availability a
left join (
  select oi.dish_id, sum(oi.qty) as portions_30min
  from public.order_items oi
  where oi.created_at > now() - interval '30 minutes'
  group by oi.dish_id
) v on v.dish_id = a.id;

-- ---------- prep sheet + purchase order ----------
-- Usage history comes from the stock_events ledger (reason = 'order').
-- predicted_usage prefers the average for tomorrow's day-of-week, falling
-- back to the overall daily average. reorder_qty carries a 20% buffer.
drop function if exists public.prep_sheet(uuid);
create function public.prep_sheet(rid uuid)
returns table (
  ingredient_id uuid,
  ingredient text,
  unit text,
  station text,
  current_stock numeric,
  avg_daily_usage numeric,
  predicted_usage numeric,
  reorder_qty numeric,
  est_cost numeric
)
language sql stable security definer set search_path = public as $$
  with daily as (
    select
      se.ingredient_id,
      date_trunc('day', se.created_at) as day,
      -sum(se.delta) as used
    from public.stock_events se
    where se.reason = 'order' and se.restaurant_id = rid
    group by 1, 2
  ),
  overall as (
    select ingredient_id, avg(used) as avg_daily from daily group by 1
  ),
  same_dow as (
    select ingredient_id, avg(used) as dow_avg
    from daily
    where extract(dow from day) = extract(dow from now() + interval '1 day')
    group by 1
  )
  select
    i.id,
    i.name,
    i.unit,
    (
      select d.category
      from public.recipe_items r
      join public.dishes d on d.id = r.dish_id
      where r.ingredient_id = i.id
      group by d.category
      order by sum(r.qty_per_portion) desc
      limit 1
    ) as station,
    i.stock_qty,
    round(coalesce(o.avg_daily, 0), 2),
    round(coalesce(sd.dow_avg, o.avg_daily, 0), 2),
    round(greatest(0, coalesce(sd.dow_avg, o.avg_daily, 0) * 1.2 - i.stock_qty), 2),
    round(greatest(0, coalesce(sd.dow_avg, o.avg_daily, 0) * 1.2 - i.stock_qty) * i.cost_per_unit, 0)
  from public.ingredients i
  left join overall o on o.ingredient_id = i.id
  left join same_dow sd on sd.ingredient_id = i.id
  where i.restaurant_id = rid
    and (auth.uid() is null or rid = public.my_restaurant_id())
  order by coalesce(sd.dow_avg, o.avg_daily, 0) desc, i.name
$$;

revoke execute on function public.prep_sheet(uuid) from public, anon;
grant execute on function public.prep_sheet(uuid) to authenticated;
