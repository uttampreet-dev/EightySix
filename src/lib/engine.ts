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
