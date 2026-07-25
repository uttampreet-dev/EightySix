"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailability, type OrderStatus } from "@/lib/engine";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function placeOrder(
  restaurantId: string,
  tableId: string | null,
  items: { dishId: string; qty: number }[]
): Promise<ActionResult<{ orderId: string }>> {
  if (items.length === 0) return { ok: false, error: "Your cart is empty." };

  const supabase = createAdminClient();

  // Re-check availability at order time — the menu the diner sees may be stale.
  const availability = await getAvailability(supabase, restaurantId);
  const byId = new Map(availability.map((d) => [d.id, d]));
  for (const item of items) {
    const dish = byId.get(item.dishId);
    if (!dish) return { ok: false, error: "Dish not found." };
    if (!dish.is_active || dish.portions_left < item.qty) {
      return {
        ok: false,
        error: `${dish.name} just ran out — only ${Math.max(0, dish.portions_left)} left.`,
      };
    }
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({ restaurant_id: restaurantId, table_id: tableId })
    .select("id")
    .single();
  if (orderError) return { ok: false, error: orderError.message };

  const { error: itemsError } = await supabase.from("order_items").insert(
    items.map((i) => ({ order_id: order.id, dish_id: i.dishId, qty: i.qty }))
  );
  if (itemsError) return { ok: false, error: itemsError.message };

  if (tableId) {
    await supabase.from("tables").update({ status: "occupied" }).eq("id", tableId);
  }

  return { ok: true, data: { orderId: order.id } };
}

export async function bumpOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };

  if (status === "served" || status === "paid") {
    const { data: order } = await supabase
      .from("orders")
      .select("table_id")
      .eq("id", orderId)
      .single();
    if (order?.table_id) {
      await supabase.from("tables").update({ status: "free" }).eq("id", order.table_id);
    }
  }
  return { ok: true };
}

export async function adjustStock(
  ingredientId: string,
  kind: "out" | "low" | "restock",
  amount?: number
): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { data: ingredient, error: fetchError } = await supabase
    .from("ingredients")
    .select("stock_qty, reorder_level")
    .eq("id", ingredientId)
    .single();
  if (fetchError) return { ok: false, error: fetchError.message };

  let delta: number;
  let reason: "manual" | "prep";
  if (kind === "out") {
    delta = -ingredient.stock_qty;
    reason = "manual";
  } else if (kind === "low") {
    delta = ingredient.reorder_level - ingredient.stock_qty;
    reason = "manual";
  } else {
    if (!amount || amount <= 0) return { ok: false, error: "Invalid amount." };
    delta = amount;
    reason = "prep";
  }

  if (delta === 0) return { ok: true };

  const { error } = await supabase
    .from("stock_events")
    .insert({ ingredient_id: ingredientId, delta, reason });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
