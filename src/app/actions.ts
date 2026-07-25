"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  atRiskDishes,
  formatEta,
  getAvailability,
  getDishRisk,
  getTodayOrders,
  orderTotal,
  type OrderStatus,
} from "@/lib/engine";
import { geminiJSON, geminiText } from "@/lib/gemini";

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

export async function updateIngredient(
  ingredientId: string,
  updates: { stockQty?: number; reorderLevel?: number }
): Promise<ActionResult> {
  const supabase = createAdminClient();

  if (updates.stockQty !== undefined) {
    if (updates.stockQty < 0) return { ok: false, error: "Stock can't be negative." };
    const { data: ingredient, error } = await supabase
      .from("ingredients")
      .select("stock_qty")
      .eq("id", ingredientId)
      .single();
    if (error) return { ok: false, error: error.message };

    const delta = updates.stockQty - Number(ingredient.stock_qty);
    if (delta !== 0) {
      const { error: eventError } = await supabase
        .from("stock_events")
        .insert({ ingredient_id: ingredientId, delta, reason: "manual" });
      if (eventError) return { ok: false, error: eventError.message };
    }
  }

  if (updates.reorderLevel !== undefined) {
    if (updates.reorderLevel < 0) return { ok: false, error: "Reorder level can't be negative." };
    const { error } = await supabase
      .from("ingredients")
      .update({ reorder_level: updates.reorderLevel })
      .eq("id", ingredientId);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

export type SwapSuggestion = {
  dishId: string;
  name: string;
  price: number;
  veg: boolean;
  reason: string;
};

export async function suggestSwap(
  dishId: string
): Promise<ActionResult<{ suggestions: SwapSuggestion[] }>> {
  const supabase = createAdminClient();

  const { data: dead, error } = await supabase
    .from("dishes")
    .select("id, restaurant_id, name, category, veg, price")
    .eq("id", dishId)
    .single();
  if (error) return { ok: false, error: error.message };

  const availability = await getAvailability(supabase, dead.restaurant_id);
  const candidates = availability.filter(
    (d) => d.id !== dead.id && d.is_active && d.portions_left > 0
  );
  if (candidates.length === 0)
    return { ok: false, error: "Nothing else is available right now." };

  const menu = candidates
    .map(
      (d) =>
        `- ${d.name} | id=${d.id} | ${d.category} | ${d.veg ? "veg" : "non-veg"} | ₹${d.price} | ${d.portions_left} left`
    )
    .join("\n");

  let picks: { id: string; reason: string }[];
  try {
    const result = await geminiJSON<{ suggestions: { id: string; reason: string }[] }>(
      `A diner at a North Indian restaurant wants "${dead.name}" (${dead.category}, ${dead.veg ? "veg" : "non-veg"}, ₹${dead.price}) but it just sold out.
From ONLY this list of currently available dishes, pick the 2 closest substitutes. Prefer same category and similar main ingredient, respect veg/non-veg, similar price.
${menu}
Return JSON: {"suggestions":[{"id":"<id from list>","reason":"<one short appetising sentence>"}]}`
    );
    picks = result.suggestions ?? [];
  } catch {
    // Gemini down → nearest same-category dishes so the intervention still works
    picks = candidates
      .filter((d) => d.category === dead.category && d.veg === dead.veg)
      .slice(0, 2)
      .map((d) => ({ id: d.id, reason: `Closest available match to ${dead.name}.` }));
  }

  // Ground the model: only accept ids that are genuinely available.
  const byId = new Map(candidates.map((d) => [d.id, d]));
  const suggestions = picks
    .filter((p) => byId.has(p.id))
    .slice(0, 2)
    .map((p) => {
      const d = byId.get(p.id)!;
      return { dishId: d.id, name: d.name, price: d.price, veg: d.veg, reason: p.reason };
    });

  if (suggestions.length === 0)
    return { ok: false, error: "No good substitute available right now." };
  return { ok: true, data: { suggestions } };
}

export async function getMorningBrief(
  restaurantId: string
): Promise<ActionResult<{ brief: string }>> {
  const supabase = createAdminClient();
  try {
    const [orders, risk] = await Promise.all([
      getTodayOrders(supabase, restaurantId),
      getDishRisk(supabase, restaurantId),
    ]);
    const { data: lowStock } = await supabase
      .from("ingredients")
      .select("name, stock_qty, reorder_level, unit")
      .eq("restaurant_id", restaurantId);

    const revenue = orders.reduce((s, o) => s + orderTotal(o), 0);
    const dying = atRiskDishes(risk)
      .map((d) => `${d.name}: ${d.portions_left} left, 86 in ${formatEta(d.minutes_to_86!)}`)
      .join("; ") || "none";
    const dead = risk.filter((d) => d.portions_left <= 0).map((d) => d.name).join(", ") || "none";
    const low = (lowStock ?? [])
      .filter((i) => Number(i.stock_qty) <= Number(i.reorder_level))
      .map((i) => `${i.name} (${i.stock_qty}${i.unit})`)
      .join(", ") || "none";

    const brief = await geminiText(
      `You are the operations brain of a North Indian restaurant. Write a crisp manager briefing (max 4 short bullet points, plain text, no markdown headers) from this live data:
- Orders today: ${orders.length}, revenue ₹${revenue}
- Dishes at risk of 86 (predicted from live order velocity): ${dying}
- Already sold out: ${dead}
- Ingredients at/below reorder level: ${low}
Focus on actions: what to prep, what to push, what to buy. Be specific and terse.`
    );
    return { ok: true, data: { brief } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Brief failed." };
  }
}

export async function toggleTableStatus(tableId: string): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { data: table, error: fetchError } = await supabase
    .from("tables")
    .select("status")
    .eq("id", tableId)
    .single();
  if (fetchError) return { ok: false, error: fetchError.message };

  const { error } = await supabase
    .from("tables")
    .update({ status: table.status === "free" ? "occupied" : "free" })
    .eq("id", tableId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
