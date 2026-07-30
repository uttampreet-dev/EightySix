"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { useChime } from "@/lib/use-chime";
import { ORDER_STATUS_BADGE } from "@/lib/status-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
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
  // null until mount: order ages must not render on the server, or a minute
  // boundary between SSR and hydration throws a hydration mismatch
  const [now, setNow] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);
  const play = useChime();
  const chime = useCallback(() => {
    if (soundRef.current) play();
  }, [play]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t0 = setTimeout(tick, 0); // first paint after hydration
    const t = setInterval(tick, 15000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
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
          chime();
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
      // reset_demo bulk-DELETEs orders; DELETE payloads don't carry the
      // filter column, so this binding must stay unfiltered.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders" },
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
      // reset restores stock via a direct ingredients UPDATE (no stock_events)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ingredients",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          if (stockTimer) clearTimeout(stockTimer);
          stockTimer = setTimeout(refetchIngredients, 300);
        }
      )
      .subscribe((status) => {
        // catch up on anything missed while disconnected
        if (status === "SUBSCRIBED") {
          refetchOrders();
          refetchIngredients();
        }
      });

    return () => {
      if (orderTimer) clearTimeout(orderTimer);
      if (stockTimer) clearTimeout(stockTimer);
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, refetchOrders, refetchIngredients, chime]);

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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                soundRef.current = !soundRef.current;
                setSoundOn(soundRef.current);
                if (soundRef.current) chime();
              }}
            >
              {soundOn ? "Sound on" : "Muted"}
            </Button>
            <ThemeToggle />
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
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No open orders — they land here the second a diner places one.
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Order from the{" "}
                <span className="font-medium text-foreground">live menu</span>,
                or run the dinner rush from the owner dashboard.
              </p>
            </div>
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
                        variant="outline"
                        className={`font-mono ${ORDER_STATUS_BADGE[order.status]}`}
                      >
                        {order.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {now !== null && orderAge(order.created_at, now)}
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
                      ? "border-red-600/35 dark:border-red-900/60 bg-red-500/10 dark:bg-red-950/30"
                      : tone === "low"
                        ? "border-amber-600/35 dark:border-amber-800/50 bg-amber-500/10 dark:bg-amber-950/20"
                        : "bg-card"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {ingredient.name}
                    </p>
                    <motion.p
                      key={Number(ingredient.stock_qty)}
                      initial={{ opacity: 0.3 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      className={`text-xs tabular-nums ${
                        tone === "out"
                          ? "text-red-600 dark:text-red-400"
                          : tone === "low"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {Number(ingredient.stock_qty).toFixed(1)} {ingredient.unit}
                      {tone === "out" && " · OUT"}
                      {tone === "low" && " · LOW"}
                    </motion.p>
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
                      className="h-7 px-2 text-xs text-amber-600 dark:text-amber-400"
                      disabled={tone !== "ok"}
                      onClick={() => stock(ingredient, "low")}
                    >
                      Low
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs text-red-600 dark:text-red-400"
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
