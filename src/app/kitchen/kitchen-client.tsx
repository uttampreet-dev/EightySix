"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  getIngredients,
  getOpenOrders,
  type Ingredient,
  type OrderWithItems,
  type Restaurant,
} from "@/lib/engine";
import { adjustStock, bumpOrderStatus } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { SignOutButton } from "@/components/sign-out-button";

function orderAge(createdAt: string, now: number): string {
  const mins = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
  return mins === 0 ? "just now" : `${mins}m ago`;
}

function stockTone(i: Ingredient): "out" | "low" | "ok" {
  if (i.stock_qty <= 0) return "out";
  if (i.stock_qty <= i.reorder_level) return "low";
  return "ok";
}

export function KitchenClient({
  restaurant,
  initialOrders,
  initialIngredients,
}: {
  restaurant: Restaurant;
  initialOrders: OrderWithItems[];
  initialIngredients: Ingredient[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const refetchOrders = useCallback(async () => {
    const supabase = createClient();
    setOrders(await getOpenOrders(supabase, restaurant.id));
  }, [restaurant.id]);

  const refetchIngredients = useCallback(async () => {
    const supabase = createClient();
    setIngredients(await getIngredients(supabase, restaurant.id));
  }, [restaurant.id]);

  useEffect(() => {
    const supabase = createClient();
    let orderTimer: ReturnType<typeof setTimeout> | null = null;
    let stockTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`kitchen-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          toast.info("New order in");
          if (orderTimer) clearTimeout(orderTimer);
          orderTimer = setTimeout(refetchOrders, 300);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          if (orderTimer) clearTimeout(orderTimer);
          orderTimer = setTimeout(refetchOrders, 300);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stock_events",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          if (stockTimer) clearTimeout(stockTimer);
          stockTimer = setTimeout(refetchIngredients, 300);
        }
      )
      .subscribe();

    return () => {
      if (orderTimer) clearTimeout(orderTimer);
      if (stockTimer) clearTimeout(stockTimer);
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, refetchOrders, refetchIngredients]);

  async function bump(order: OrderWithItems) {
    const next = order.status === "placed" ? "cooking" : "served";
    const result = await bumpOrderStatus(order.id, next);
    if (!result.ok) toast.error(result.error);
    refetchOrders();
  }

  async function stock(ingredient: Ingredient, kind: "out" | "low" | "restock", amount?: number) {
    const result = await adjustStock(ingredient.id, kind, amount);
    if (!result.ok) toast.error(result.error);
    else if (kind === "out") toast.error(`${ingredient.name} marked OUT`);
    refetchIngredients();
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12">
      <Toaster position="top-center" richColors />

      <header className="sticky top-0 z-10 -mx-4 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight">Kitchen</h1>
            <p className="text-xs text-muted-foreground">{restaurant.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {orders.length} open order{orders.length === 1 ? "" : "s"}
            </Badge>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_420px]">
        <section>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Order queue
          </h2>
          {orders.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No open orders. They&apos;ll appear here the moment a diner
              places one.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <AnimatePresence initial={false}>
              {orders.map((order) => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  className="rounded-lg border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      Table {order.tables?.label ?? "—"}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={order.status === "placed" ? "default" : "secondary"}
                      >
                        {order.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {orderAge(order.created_at, now)}
                      </span>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {order.order_items.map((item) => (
                      <li key={item.id} className="flex justify-between">
                        <span>{item.dishes?.name ?? "Unknown dish"}</span>
                        <span className="text-muted-foreground">× {item.qty}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    className="mt-4 w-full"
                    variant={order.status === "placed" ? "default" : "secondary"}
                    onClick={() => bump(order)}
                  >
                    {order.status === "placed" ? "Start cooking" : "Mark served"}
                  </Button>
                </motion.div>
              ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            86 board — stock
          </h2>
          <div className="space-y-1.5">
            {ingredients.map((ingredient) => {
              const tone = stockTone(ingredient);
              return (
                <div
                  key={ingredient.id}
                  className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                    tone === "out"
                      ? "border-red-900/60 bg-red-950/30"
                      : tone === "low"
                        ? "border-amber-800/50 bg-amber-950/20"
                        : "bg-card"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {ingredient.name}
                    </p>
                    <p
                      className={`text-xs tabular-nums ${
                        tone === "out"
                          ? "text-red-400"
                          : tone === "low"
                            ? "text-amber-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {Number(ingredient.stock_qty).toFixed(1)} {ingredient.unit}
                      {tone === "out" && " · OUT"}
                      {tone === "low" && " · LOW"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        stock(
                          ingredient,
                          "restock",
                          Math.max(0.5, Number(ingredient.reorder_level) * 2)
                        )
                      }
                    >
                      Restock
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs text-amber-400"
                      disabled={tone !== "ok"}
                      onClick={() => stock(ingredient, "low")}
                    >
                      Low
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs text-red-400"
                      disabled={tone === "out"}
                      onClick={() => stock(ingredient, "out")}
                    >
                      Out
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
