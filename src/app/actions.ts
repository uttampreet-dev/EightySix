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
): Promise<ActionResult<{ suggestions: SwapSuggestion[]; outOf: string | null }>> {
  const supabase = createAdminClient();

  const { data: dead, error } = await supabase
    .from("dishes")
    .select("id, restaurant_id, name, category, veg, price")
    .eq("id", dishId)
    .single();
  if (error) return { ok: false, error: error.message };

  // Which ingredient actually killed it — real cause, from the recipe graph.
  const { data: recipe } = await supabase
    .from("recipe_items")
    .select("qty_per_portion, ingredients(name, stock_qty)")
    .eq("dish_id", dishId)
    .returns<{ qty_per_portion: number; ingredients: { name: string; stock_qty: number } | null }[]>();
  const limiting = (recipe ?? [])
    .filter((r) => r.ingredients)
    .map((r) => ({
      name: r.ingredients!.name,
      ratio: Number(r.ingredients!.stock_qty) / Number(r.qty_per_portion),
    }))
    .sort((a, b) => a.ratio - b.ratio)[0];
  const outOf = limiting && limiting.ratio < 1 ? limiting.name : null;

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
  return { ok: true, data: { suggestions, outOf } };
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

// Popularity weights for the dinner-rush simulator. Unlisted dishes weight 1.
const RUSH_WEIGHTS: Record<string, number> = {
  "Butter Naan": 6,
  "Butter Paneer": 5,
  "Butter Chicken": 5,
  "Dal Makhani": 4,
  "Garlic Naan": 4,
  "Chicken Biryani": 4,
  "Paneer Tikka": 3,
  "Tandoori Chicken (Half)": 3,
  "Tandoori Roti": 3,
  "Chicken Tikka Masala": 2,
  "Masala Chai": 2,
  "Sweet Lassi": 2,
};

function weightedPick<T extends { name: string }>(items: T[]): T {
  const total = items.reduce((s, i) => s + (RUSH_WEIGHTS[i.name] ?? 1), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= RUSH_WEIGHTS[item.name] ?? 1;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

// One synthetic order burst. The client loop calls this every few seconds
// during a simulated rush; every order flows through the exact same tables
// and triggers as a real one, so every screen reacts for real.
export async function rushTick(
  restaurantId: string
): Promise<ActionResult<{ placed: string[] }>> {
  const supabase = createAdminClient();

  const availability = await getAvailability(supabase, restaurantId);
  const candidates = availability.filter((d) => d.is_active && d.portions_left > 0);
  if (candidates.length === 0)
    return { ok: false, error: "Everything is 86'd — reset the demo to keep going." };

  const { data: tables } = await supabase
    .from("tables")
    .select("id")
    .eq("restaurant_id", restaurantId);
  const tableId =
    tables && tables.length > 0
      ? tables[Math.floor(Math.random() * tables.length)].id
      : null;

  const itemCount = 1 + Math.floor(Math.random() * 3); // 1–3 dishes per order
  const chosen = new Map<string, { dishId: string; name: string; qty: number }>();
  for (let i = 0; i < itemCount; i++) {
    const dish = weightedPick(candidates);
    const existing = chosen.get(dish.id);
    const qty = 1 + Math.floor(Math.random() * 2); // 1–2 portions
    const capped = Math.min(qty, dish.portions_left - (existing?.qty ?? 0));
    if (capped <= 0) continue;
    chosen.set(dish.id, {
      dishId: dish.id,
      name: dish.name,
      qty: (existing?.qty ?? 0) + capped,
    });
  }
  if (chosen.size === 0) return { ok: true, data: { placed: [] } };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({ restaurant_id: restaurantId, table_id: tableId })
    .select("id")
    .single();
  if (orderError) return { ok: false, error: orderError.message };

  const items = [...chosen.values()];
  const { error: itemsError } = await supabase.from("order_items").insert(
    items.map((i) => ({ order_id: order.id, dish_id: i.dishId, qty: i.qty }))
  );
  if (itemsError) return { ok: false, error: itemsError.message };

  return { ok: true, data: { placed: items.map((i) => `${i.name} ×${i.qty}`) } };
}

export async function setDishActive(
  dishId: string,
  active: boolean
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("dishes")
    .update({ is_active: active })
    .eq("id", dishId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function upsertDish(
  restaurantId: string,
  dish: {
    id?: string;
    name: string;
    price: number;
    category: string;
    veg: boolean;
  },
  recipe: { ingredientId: string; qty: number }[]
): Promise<ActionResult<{ dishId: string }>> {
  if (!dish.name.trim()) return { ok: false, error: "Dish needs a name." };
  if (dish.price <= 0) return { ok: false, error: "Price must be positive." };
  if (recipe.length === 0)
    return { ok: false, error: "A dish needs at least one recipe ingredient — availability is computed from it." };
  if (recipe.some((r) => r.qty <= 0))
    return { ok: false, error: "Recipe quantities must be positive." };

  const supabase = createAdminClient();
  let dishId = dish.id;

  if (dishId) {
    const { error } = await supabase
      .from("dishes")
      .update({ name: dish.name.trim(), price: dish.price, category: dish.category, veg: dish.veg })
      .eq("id", dishId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from("dishes")
      .insert({
        restaurant_id: restaurantId,
        name: dish.name.trim(),
        price: dish.price,
        category: dish.category,
        veg: dish.veg,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    dishId = data.id;
  }

  const { error: deleteError } = await supabase
    .from("recipe_items")
    .delete()
    .eq("dish_id", dishId);
  if (deleteError) return { ok: false, error: deleteError.message };

  const { error: recipeError } = await supabase.from("recipe_items").insert(
    recipe.map((r) => ({
      dish_id: dishId,
      ingredient_id: r.ingredientId,
      qty_per_portion: r.qty,
    }))
  );
  if (recipeError) return { ok: false, error: recipeError.message };

  return { ok: true, data: { dishId: dishId! } };
}

export async function createIngredient(
  restaurantId: string,
  ingredient: {
    name: string;
    unit: string;
    stockQty: number;
    reorderLevel: number;
    costPerUnit: number;
  }
): Promise<ActionResult> {
  if (!ingredient.name.trim()) return { ok: false, error: "Ingredient needs a name." };
  const supabase = createAdminClient();
  const { error } = await supabase.from("ingredients").insert({
    restaurant_id: restaurantId,
    name: ingredient.name.trim(),
    unit: ingredient.unit || "kg",
    stock_qty: Math.max(0, ingredient.stockQty),
    reorder_level: Math.max(0, ingredient.reorderLevel),
    cost_per_unit: Math.max(0, ingredient.costPerUnit),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function createReservation(
  restaurantId: string,
  reservation: {
    name: string;
    phone: string;
    partySize: number;
    reservedAt: string;
    note?: string;
  }
): Promise<ActionResult> {
  if (!reservation.name.trim()) return { ok: false, error: "Name is required." };
  if (!/^[0-9+\-\s]{8,15}$/.test(reservation.phone.trim()))
    return { ok: false, error: "Enter a valid phone number." };
  if (new Date(reservation.reservedAt).getTime() < Date.now() - 60000)
    return { ok: false, error: "Pick a time in the future." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("reservations").insert({
    restaurant_id: restaurantId,
    name: reservation.name.trim(),
    phone: reservation.phone.trim(),
    party_size: reservation.partySize,
    reserved_at: reservation.reservedAt,
    note: reservation.note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateReservation(
  reservationId: string,
  updates: {
    status?: "booked" | "seated" | "completed" | "cancelled";
    tableId?: string | null;
  }
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const payload: Record<string, unknown> = {};
  if (updates.status) payload.status = updates.status;
  if (updates.tableId !== undefined) payload.table_id = updates.tableId;

  const { error } = await supabase
    .from("reservations")
    .update(payload)
    .eq("id", reservationId);
  if (error) return { ok: false, error: error.message };

  // Seating a party occupies its table; completing/cancelling frees it.
  if (updates.status && updates.tableId !== undefined && updates.tableId) {
    await supabase
      .from("tables")
      .update({ status: updates.status === "seated" ? "occupied" : "free" })
      .eq("id", updates.tableId);
  }
  return { ok: true };
}

export async function submitFeedback(
  orderId: string,
  rating: number,
  comment: string
): Promise<ActionResult> {
  if (rating < 1 || rating > 5) return { ok: false, error: "Rating must be 1–5." };
  const supabase = createAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("restaurant_id, status")
    .eq("id", orderId)
    .single();
  if (orderError) return { ok: false, error: "Order not found." };
  if (order.status !== "served" && order.status !== "paid")
    return { ok: false, error: "You can rate once your order is served." };

  const { error } = await supabase.from("feedback").insert({
    restaurant_id: order.restaurant_id,
    order_id: orderId,
    rating,
    comment: comment.trim() || null,
  });
  if (error)
    return {
      ok: false,
      error: error.code === "23505" ? "This order was already rated — thank you!" : error.message,
    };
  return { ok: true };
}

export async function createStaff(
  email: string,
  password: string,
  role: "owner" | "kitchen"
): Promise<ActionResult> {
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  if (password.length < 8) return { ok: false, error: "Password needs 8+ characters." };
  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getFeedbackSummary(
  restaurantId: string
): Promise<ActionResult<{ summary: string }>> {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("feedback")
    .select("rating, comment")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (!rows || rows.length === 0)
    return { ok: false, error: "No feedback yet to summarise." };

  try {
    const summary = await geminiText(
      `Summarise this restaurant's diner feedback in 3 short plain-text bullets (themes + one action each). Ratings are 1–5.
${rows.map((r) => `${r.rating}/5${r.comment ? ` — "${r.comment}"` : ""}`).join("\n")}`
    );
    return { ok: true, data: { summary } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Summary failed." };
  }
}

export async function resetDemo(): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("reset_demo");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
