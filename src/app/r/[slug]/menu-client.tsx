"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  availabilityState,
  categoryRank,
  formatINR,
  getAvailability,
  type DishAvailability,
  type Restaurant,
  type RestaurantTable,
} from "@/lib/engine";
import { placeOrder, suggestSwap, type SwapSuggestion } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";

function VegMark({ veg }: { veg: boolean }) {
  return (
    <span
      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${
        veg ? "border-green-600" : "border-red-700"
      }`}
      title={veg ? "Veg" : "Non-veg"}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${veg ? "bg-green-500" : "bg-red-600"}`}
      />
    </span>
  );
}

export function MenuClient({
  restaurant,
  initialDishes,
  tables,
}: {
  restaurant: Restaurant;
  initialDishes: DishAvailability[];
  tables: RestaurantTable[];
}) {
  const [dishes, setDishes] = useState(initialDishes);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [tableId, setTableId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [swapFor, setSwapFor] = useState<DishAvailability | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swaps, setSwaps] = useState<SwapSuggestion[]>([]);
  const [swapError, setSwapError] = useState<string | null>(null);
  const dishesRef = useRef(dishes);
  useEffect(() => {
    dishesRef.current = dishes;
  }, [dishes]);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const fresh = await getAvailability(supabase, restaurant.id);

    // Announce transitions the diner should notice.
    const prev = new Map(dishesRef.current.map((d) => [d.id, d]));
    for (const dish of fresh) {
      const before = prev.get(dish.id);
      if (!before) continue;
      const was = availabilityState(before);
      const now = availabilityState(dish);
      if (was !== "out" && now === "out") {
        toast.error(`${dish.name} just got 86'd`, {
          description: "Sold out — struck off the menu.",
        });
      } else if (was === "available" && now === "low") {
        toast.warning(`${dish.name} is running low`, {
          description: `Only ${dish.portions_left} left.`,
        });
      }
    }
    setDishes(fresh);
  }, [restaurant.id]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refetch, 250);
    };

    const channel = supabase
      .channel(`menu-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stock_events",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        scheduleRefetch
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dishes",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        scheduleRefetch
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, refetch]);

  const categories = useMemo(() => {
    const byCategory = new Map<string, DishAvailability[]>();
    for (const dish of dishes) {
      if (!byCategory.has(dish.category)) byCategory.set(dish.category, []);
      byCategory.get(dish.category)!.push(dish);
    }
    return [...byCategory.entries()]
      .sort(([a], [b]) => categoryRank(a) - categoryRank(b))
      .map(([name, categoryDishes]) => ({ name, dishes: categoryDishes }));
  }, [dishes]);

  const cartEntries = useMemo(() => {
    const byId = new Map(dishes.map((d) => [d.id, d]));
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ dish: byId.get(id)!, qty }))
      .filter((e) => e.dish);
  }, [cart, dishes]);

  const cartCount = cartEntries.reduce((sum, e) => sum + e.qty, 0);
  const cartTotal = cartEntries.reduce((sum, e) => sum + e.dish.price * e.qty, 0);

  const setQty = (dishId: string, qty: number) =>
    setCart((c) => ({ ...c, [dishId]: Math.max(0, qty) }));

  async function openSwap(dish: DishAvailability) {
    setSwapFor(dish);
    setSwaps([]);
    setSwapError(null);
    setSwapLoading(true);
    const result = await suggestSwap(dish.id);
    setSwapLoading(false);
    if (result.ok && result.data) setSwaps(result.data.suggestions);
    else if (!result.ok) setSwapError(result.error);
  }

  async function submitOrder() {
    setPlacing(true);
    const result = await placeOrder(
      restaurant.id,
      tableId,
      cartEntries.map((e) => ({ dishId: e.dish.id, qty: e.qty }))
    );
    setPlacing(false);
    if (result.ok) {
      toast.success("Order placed", {
        description: "The kitchen has it — sit tight.",
      });
      setCart({});
      setSheetOpen(false);
    } else {
      toast.error("Couldn't place order", { description: result.error });
      refetch();
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28">
      <Toaster position="top-center" richColors />

      <header className="sticky top-0 z-10 -mx-4 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight">
              {restaurant.name}
            </h1>
            {restaurant.tagline && (
              <p className="text-xs text-muted-foreground">{restaurant.tagline}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-xs text-muted-foreground">Live menu</span>
          </div>
        </div>
      </header>

      {categories.map(({ name, dishes: categoryDishes }) => (
        <section key={name} className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="shrink-0 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              {name}
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {categoryDishes.map((dish) => {
              const state = availabilityState(dish);
              const qty = cart[dish.id] ?? 0;
              const out = state === "out";
              return (
                <div
                  key={dish.id}
                  className={`rounded-lg border bg-card p-4 transition-all duration-700 ${
                    out
                      ? "opacity-45 saturate-0"
                      : "hover:border-brass/25 hover:shadow-[0_2px_16px_-8px_oklch(0.8_0.1_84/0.25)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <VegMark veg={dish.veg} />
                      <h3
                        className={`font-serif text-[17px] leading-tight ${
                          out ? "line-through decoration-brass/60" : ""
                        }`}
                      >
                        {dish.name}
                      </h3>
                    </div>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                      {formatINR(dish.price)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      {out ? (
                        <Badge variant="destructive" className="font-mono">
                          86&apos;d — sold out
                        </Badge>
                      ) : state === "low" ? (
                        <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-400">
                          Only {dish.portions_left} left
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {dish.portions_left} portions
                        </span>
                      )}
                    </div>

                    {out && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openSwap(dish)}
                      >
                        Suggest a swap
                      </Button>
                    )}
                    {!out &&
                      (qty === 0 ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setQty(dish.id, 1)}
                        >
                          Add
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => setQty(dish.id, qty - 1)}
                          >
                            −
                          </Button>
                          <span className="w-4 text-center text-sm tabular-nums">
                            {qty}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            disabled={qty >= dish.portions_left}
                            onClick={() => setQty(dish.id, qty + 1)}
                          >
                            +
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <Dialog open={swapFor !== null} onOpenChange={(open) => !open && setSwapFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{swapFor?.name} is 86&apos;d</DialogTitle>
            <DialogDescription>
              {swapLoading
                ? "Finding the closest match still in the kitchen…"
                : "Closest available alternatives, picked from live stock:"}
            </DialogDescription>
          </DialogHeader>
          {swapError && <p className="text-sm text-destructive">{swapError}</p>}
          <div className="space-y-3">
            {swaps.map((s) => (
              <div key={s.dishId} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <VegMark veg={s.veg} />
                    <p className="font-medium">{s.name}</p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {formatINR(s.price)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.reason}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 w-full"
                  onClick={() => {
                    setQty(s.dishId, (cart[s.dishId] ?? 0) + 1);
                    setSwapFor(null);
                    toast.success(`${s.name} added to your order`);
                  }}
                >
                  Add instead
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">
                {cartCount} item{cartCount > 1 ? "s" : ""} · {formatINR(cartTotal)}
              </p>
              <p className="text-xs text-muted-foreground">
                {tableId
                  ? `Table ${tables.find((t) => t.id === tableId)?.label}`
                  : "No table selected"}
              </p>
            </div>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button>Review order</Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="mx-auto max-w-3xl">
                <SheetHeader>
                  <SheetTitle>Your order</SheetTitle>
                  <SheetDescription>
                    Availability is re-checked the moment you confirm.
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-3 px-4">
                  {cartEntries.map(({ dish, qty: itemQty }) => (
                    <div
                      key={dish.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <VegMark veg={dish.veg} />
                        {dish.name} × {itemQty}
                      </span>
                      <span className="text-muted-foreground">
                        {formatINR(dish.price * itemQty)}
                      </span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Total</span>
                    <span>{formatINR(cartTotal)}</span>
                  </div>
                  <Select
                    value={tableId ?? undefined}
                    onValueChange={(v) => setTableId(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select your table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          Table {t.label} · {t.seats} seats
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <SheetFooter>
                  <Button
                    onClick={submitOrder}
                    disabled={placing || !tableId}
                    className="w-full"
                  >
                    {placing
                      ? "Placing…"
                      : tableId
                        ? `Place order · ${formatINR(cartTotal)}`
                        : "Select a table first"}
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}
    </div>
  );
}
