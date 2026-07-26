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
    .eq("restaurant_id", restaurantId);
  if (error) throw error;
  return (data ?? []).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true })
  );
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

export async function getOrdersByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<OrderWithItems[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, restaurant_id, table_id, status, created_at, order_items(id, dish_id, qty, status, dishes(name)), tables(label)"
    )
    .in("id", ids)
    .order("created_at", { ascending: false })
    .returns<OrderWithItems[]>();
  if (error) throw error;
  return data ?? [];
}

export type Reservation = {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  party_size: number;
  reserved_at: string;
  table_id: string | null;
  status: "booked" | "seated" | "completed" | "cancelled";
  note: string | null;
  created_at: string;
  tables: { label: string } | null;
};

export async function getReservations(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select("*, tables(label)")
    .eq("restaurant_id", restaurantId)
    .order("reserved_at", { ascending: true })
    .returns<Reservation[]>();
  if (error) throw error;
  return data ?? [];
}

export type Feedback = {
  id: string;
  restaurant_id: string;
  order_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export async function getFeedback(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .returns<Feedback[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getOrdersSince(
  supabase: SupabaseClient,
  restaurantId: string,
  sinceIso: string
): Promise<TodayOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, created_at, table_id, order_items(id, qty, dishes(name, price, category)), tables(label)"
    )
    .eq("restaurant_id", restaurantId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .returns<TodayOrder[]>();
  if (error) throw error;
  return data ?? [];
}

export type Analytics = {
  perDay: { day: string; label: string; revenue: number; orders: number }[];
  byCategory: { category: string; revenue: number; share: number }[];
  topDishes: { name: string; qty: number; revenue: number }[];
  byHour: { hour: number; count: number }[];
  totals: { revenue: number; orders: number; avgOrder: number };
};

export function computeAnalytics(orders: TodayOrder[], days = 7): Analytics {
  const dayBuckets = new Map<string, { revenue: number; orders: number }>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayBuckets.set(d.toDateString(), { revenue: 0, orders: 0 });
  }

  const categories = new Map<string, number>();
  const dishes = new Map<string, { qty: number; revenue: number }>();
  const hours = new Array<number>(24).fill(0);
  let revenue = 0;

  for (const order of orders) {
    const total = orderTotal(order);
    revenue += total;
    const created = new Date(order.created_at);
    const key = created.toDateString();
    const bucket = dayBuckets.get(key);
    if (bucket) {
      bucket.revenue += total;
      bucket.orders += 1;
    }
    hours[created.getHours()]++;
    for (const item of order.order_items) {
      const dish = item.dishes as
        | { name: string; price: number; category?: string }
        | null;
      if (!dish) continue;
      const line = item.qty * dish.price;
      categories.set(
        dish.category ?? "Other",
        (categories.get(dish.category ?? "Other") ?? 0) + line
      );
      const existing = dishes.get(dish.name) ?? { qty: 0, revenue: 0 };
      dishes.set(dish.name, {
        qty: existing.qty + item.qty,
        revenue: existing.revenue + line,
      });
    }
  }

  const perDay = [...dayBuckets.entries()].map(([day, v]) => ({
    day,
    label: new Date(day).toLocaleDateString("en-IN", { weekday: "short" }),
    ...v,
  }));
  const byCategory = [...categories.entries()]
    .map(([category, catRevenue]) => ({
      category,
      revenue: catRevenue,
      share: revenue > 0 ? catRevenue / revenue : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
  const topDishes = [...dishes.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  return {
    perDay,
    byCategory,
    topDishes,
    byHour: hours.map((count, hour) => ({ hour, count })),
    totals: {
      revenue,
      orders: orders.length,
      avgOrder: orders.length > 0 ? revenue / orders.length : 0,
    },
  };
}

export const GST_RATE = 0.05; // 2.5% CGST + 2.5% SGST

export function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// All human-readable dates pin to IST so server-rendered HTML (UTC boxes)
// matches client hydration exactly.
export const TIMEZONE = "Asia/Kolkata";

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: TIMEZONE,
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
}

export type DishRisk = DishAvailability & {
  velocity_30min: number;
  minutes_to_86: number | null;
};

export const RISK_ALERT_MINUTES = 45;
// Beyond this horizon a dish isn't "at risk", it's just selling.
export const RISK_HORIZON_MINUTES = 480;

export const CATEGORY_ORDER = [
  "Tandoor & Starters",
  "Curries",
  "Breads",
  "Rice & Biryani",
  "Beverages & Desserts",
];

export function categoryRank(category: string): number {
  const i = CATEGORY_ORDER.indexOf(category);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

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

// Dishes actively dying (has velocity, will run out within the horizon),
// soonest first.
export function atRiskDishes(risk: DishRisk[]): DishRisk[] {
  return risk
    .filter(
      (d) =>
        d.is_active &&
        d.minutes_to_86 !== null &&
        d.minutes_to_86 > 0 &&
        d.minutes_to_86 <= RISK_HORIZON_MINUTES
    )
    .sort((a, b) => a.minutes_to_86! - b.minutes_to_86!);
}

export function formatEta(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  return `~${h}h ${minutes % 60}m`;
}

export type LedgerEvent = {
  id: string;
  delta: number;
  reason: "order" | "manual" | "prep";
  created_at: string;
  ingredients: { name: string; unit: string } | null;
};

export async function getRecentEvents(
  supabase: SupabaseClient,
  restaurantId: string,
  limit = 14
): Promise<LedgerEvent[]> {
  const { data, error } = await supabase
    .from("stock_events")
    .select("id, delta, reason, created_at, ingredients(name, unit)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<LedgerEvent[]>();
  if (error) throw error;
  return data ?? [];
}

export type HealthLevel = "healthy" | "watch" | "critical";

export type RestaurantHealth = {
  level: HealthLevel;
  label: string;
  headline: string;
};

// Deterministic status — computed from the live radar, never generated.
export function restaurantHealth(risk: DishRisk[]): RestaurantHealth {
  const dying = atRiskDishes(risk);
  const dead = risk.filter((d) => d.is_active && d.portions_left <= 0);
  const critical = dying.filter((d) => d.minutes_to_86! <= RISK_ALERT_MINUTES);

  if (critical.length > 0) {
    const d = critical[0];
    return {
      level: "critical",
      label: "Critical",
      headline: `${d.name} dies in ${formatEta(d.minutes_to_86!)} at this pace — ${d.portions_left} left. Prep more now or push an alternative.`,
    };
  }
  if (dying.length > 0) {
    const d = dying[0];
    return {
      level: "watch",
      label: "Rush building",
      headline: `${d.name} is moving fastest — 86 predicted in ${formatEta(d.minutes_to_86!)}.${dead.length > 0 ? ` ${dead.length} dish${dead.length > 1 ? "es" : ""} already 86'd.` : ""}`,
    };
  }
  if (dead.length > 0) {
    return {
      level: "watch",
      label: "Attention",
      headline: `${dead.length} dish${dead.length > 1 ? "es are" : " is"} 86'd — restock the missing ingredients to bring ${dead.length > 1 ? "them" : "it"} back.`,
    };
  }
  const available = risk.filter((d) => d.is_active && d.portions_left > 0).length;
  return {
    level: "healthy",
    label: "All clear",
    headline: `All ${available} dishes available. The engine is watching live order velocity.`,
  };
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
