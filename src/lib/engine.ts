import type { SupabaseClient } from "@supabase/supabase-js";

// Single source of truth for availability semantics. The math itself lives
// in SQL (dish_availability view, stock_events triggers); this module owns
// the thresholds and typed access on top of it.

export const LOW_PORTIONS = 5;

export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
};

export type DishAvailability = {
  id: string;
  restaurant_id: string;
  name: string;
  price: number;
  category: string;
  veg: boolean;
  img: string | null;
  is_active: boolean;
  portions_left: number;
};

export type Ingredient = {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  stock_qty: number;
  reorder_level: number;
  cost_per_unit: number;
};

export type RestaurantTable = {
  id: string;
  restaurant_id: string;
  label: string;
  seats: number;
  status: "free" | "occupied";
};

export type OrderStatus = "placed" | "cooking" | "served" | "paid";

export type OrderWithItems = {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  status: OrderStatus;
  created_at: string;
  order_items: {
    id: string;
    dish_id: string;
    qty: number;
    status: "queued" | "ready";
    dishes: { name: string } | null;
  }[];
  tables: { label: string } | null;
};

export type AvailabilityState = "available" | "low" | "out";

export function availabilityState(d: DishAvailability): AvailabilityState {
  if (!d.is_active || d.portions_left <= 0) return "out";
  if (d.portions_left <= LOW_PORTIONS) return "low";
  return "available";
}

export async function getRestaurantBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Restaurant | null> {
  const { data } = await supabase
    .from("restaurants")
    .select("id, name, slug, tagline")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function getAvailability(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<DishAvailability[]> {
  const { data, error } = await supabase
    .from("dish_availability")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("category")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getIngredients(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getTables(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<RestaurantTable[]> {
  const { data, error } = await supabase
    .from("tables")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("label");
  if (error) throw error;
  return data ?? [];
}

export async function getOpenOrders(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<OrderWithItems[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, restaurant_id, table_id, status, created_at, order_items(id, dish_id, qty, status, dishes(name)), tables(label)"
    )
    .eq("restaurant_id", restaurantId)
    .in("status", ["placed", "cooking"])
    .order("created_at", { ascending: true })
    .returns<OrderWithItems[]>();
  if (error) throw error;
  return data ?? [];
}

export function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export type DishRisk = DishAvailability & {
  velocity_30min: number;
  minutes_to_86: number | null;
};

export const RISK_ALERT_MINUTES = 45;

export async function getDishRisk(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<DishRisk[]> {
  const { data, error } = await supabase
    .from("dish_risk")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

// Dishes actively dying (has velocity, will run out), soonest first.
export function atRiskDishes(risk: DishRisk[]): DishRisk[] {
  return risk
    .filter((d) => d.is_active && d.minutes_to_86 !== null && d.minutes_to_86 > 0)
    .sort((a, b) => a.minutes_to_86! - b.minutes_to_86!);
}

export function formatEta(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  return `~${h}h ${minutes % 60}m`;
}

export type TodayOrder = {
  id: string;
  status: OrderStatus;
  created_at: string;
  table_id: string | null;
  order_items: {
    id: string;
    qty: number;
    dishes: { name: string; price: number } | null;
  }[];
  tables: { label: string } | null;
};

export async function getTodayOrders(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<TodayOrder[]> {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, created_at, table_id, order_items(id, qty, dishes(name, price)), tables(label)"
    )
    .eq("restaurant_id", restaurantId)
    .gte("created_at", midnight.toISOString())
    .order("created_at", { ascending: false })
    .returns<TodayOrder[]>();
  if (error) throw error;
  return data ?? [];
}

export function orderTotal(order: TodayOrder): number {
  return order.order_items.reduce(
    (sum, item) => sum + item.qty * (item.dishes?.price ?? 0),
    0
  );
}

export type DayStats = {
  revenue: number;
  orderCount: number;
  topDishes: { name: string; qty: number }[];
  perHour: { hour: number; count: number }[];
};

export function computeDayStats(orders: TodayOrder[]): DayStats {
  const revenue = orders.reduce((sum, o) => sum + orderTotal(o), 0);

  const dishQty = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.order_items) {
      if (!item.dishes) continue;
      dishQty.set(item.dishes.name, (dishQty.get(item.dishes.name) ?? 0) + item.qty);
    }
  }
  const topDishes = [...dishQty.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const currentHour = new Date().getHours();
  const counts = new Array<number>(currentHour + 1).fill(0);
  for (const order of orders) {
    const h = new Date(order.created_at).getHours();
    if (h >= 0 && h <= currentHour) counts[h]++;
  }
  const perHour = counts.map((count, hour) => ({ hour, count }));

  return { revenue, orderCount: orders.length, topDishes, perHour };
}
