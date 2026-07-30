"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { dishImage } from "@/lib/dish-image";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  availabilityState,
  categoryRank,
  formatINR,
  getAvailability,
  getOrdersByIds,
  isSpecial,
  type DishAvailability,
  type OrderWithItems,
  type Restaurant,
  type RestaurantTable,
} from "@/lib/engine";
import {
  callWaiter,
  createReservation,
  placeOrder,
  submitFeedback,
  suggestSwap,
  type SwapSuggestion,
} from "@/app/actions";
import { useChime } from "@/lib/use-chime";
import { BellRing, ReceiptText, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ORDER_STATUS_BADGE } from "@/lib/status-colors";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";

function DishThumb({
  name,
  img,
  out,
}: {
  name: string;
  img: string | null;
  out: boolean;
}) {
  const src = dishImage({ name, img });
  if (!src) {
    return (
      <div className="flex h-19 w-19 shrink-0 items-center justify-center rounded-md border border-border/60 bg-black/2 dark:bg-white/1.5">
        <span className="font-serif text-2xl text-brass/50">{name.charAt(0)}</span>
      </div>
    );
  }
  return (
    <div className="relative h-19 w-19 shrink-0 overflow-hidden rounded-md border border-border/60">
      <Image
        src={src}
        alt={name}
        fill
        sizes="76px"
        className="object-cover"
        unoptimized
      />
      {out && (
        <span className="absolute inset-0 flex items-center justify-center bg-background/55 font-mono text-[10px] tracking-wider text-red-600 dark:text-red-400">
          86&apos;D
        </span>
      )}
    </div>
  );
}

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

const STATUS_COPY: Record<string, string> = {
  placed: "sent to the kitchen",
  cooking: "being cooked",
  served: "served — enjoy!",
};

export function MenuClient({
  restaurant,
  initialDishes,
  tables,
  initialTableLabel,
}: {
  restaurant: Restaurant;
  initialDishes: DishAvailability[];
  tables: RestaurantTable[];
  initialTableLabel: string | null;
}) {
  const [dishes, setDishes] = useState(initialDishes);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [tableId, setTableId] = useState<string | null>(
    () =>
      tables.find(
        (t) => t.label.toLowerCase() === initialTableLabel?.toLowerCase()
      )?.id ?? null
  );
  const [myOrders, setMyOrders] = useState<OrderWithItems[]>([]);
  const myOrderIdsRef = useRef<string[]>([]);
  const orderStatusRef = useRef<Map<string, string>>(new Map());
  const storageKey = `eightysix-orders-${restaurant.id}`;
  const [reserveOpen, setReserveOpen] = useState(false);
  const [reserveBusy, setReserveBusy] = useState(false);
  const [reserveForm, setReserveForm] = useState({
    name: "",
    phone: "",
    partySize: "2",
    reservedAt: "",
    note: "",
  });
  const [rateFor, setRateFor] = useState<OrderWithItems | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [paging, setPaging] = useState<"waiter" | "bill" | null>(null);
  const chime = useChime();

  async function pageFloor(kind: "waiter" | "bill") {
    if (!tableId) return;
    setPaging(kind);
    const result = await callWaiter(restaurant.id, tableId, kind);
    setPaging(null);
    if (result.ok) {
      toast.success(kind === "bill" ? "Bill requested" : "Waiter on the way", {
        description: "The floor team just got pinged — watch them appear.",
      });
    } else {
      toast.error(result.error);
    }
  }

  async function submitReservation(e: React.FormEvent) {
    e.preventDefault();
    setReserveBusy(true);
    const result = await createReservation(restaurant.id, {
      name: reserveForm.name,
      phone: reserveForm.phone,
      partySize: Number(reserveForm.partySize),
      reservedAt: new Date(reserveForm.reservedAt).toISOString(),
      note: reserveForm.note,
    });
    setReserveBusy(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Table reserved", {
        description: `${reserveForm.name} · party of ${reserveForm.partySize} — the restaurant sees it instantly.`,
      });
      setReserveOpen(false);
    }
  }

  async function submitRating() {
    if (!rateFor || rating === 0) return;
    const result = await submitFeedback(rateFor.id, rating, ratingComment);
    if (!result.ok) {
      toast.error(result.error);
      // duplicate rating: retract the button; anything else: keep the
      // dialog (and the typed comment) so the diner can retry
      if (result.error.includes("already rated")) {
        setRatedIds((s) => new Set(s).add(rateFor.id));
        setRateFor(null);
        setRating(0);
        setRatingComment("");
      }
      return;
    }
    toast.success("Thanks for the feedback!");
    setRatedIds((s) => new Set(s).add(rateFor.id));
    setRateFor(null);
    setRating(0);
    setRatingComment("");
  }
  const [placing, setPlacing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [swapFor, setSwapFor] = useState<DishAvailability | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swaps, setSwaps] = useState<SwapSuggestion[]>([]);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapOutOf, setSwapOutOf] = useState<string | null>(null);
  const dishesRef = useRef(dishes);
  useEffect(() => {
    dishesRef.current = dishes;
  }, [dishes]);
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

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
      if (!isSpecial(before) && isSpecial(dish)) {
        toast.success(`${dish.name} is tonight's chef's special`, {
          description: `Now ${formatINR(dish.price)} (was ${formatINR(dish.regular_price!)}).`,
        });
      }
    }
    setDishes(fresh);

    // A dish that died (or thinned out) must not stay stuck in the cart —
    // otherwise every "Place order" fails forever with no way out.
    const freshById = new Map(fresh.map((d) => [d.id, d]));
    const next: Record<string, number> = {};
    let changed = false;
    for (const [id, qty] of Object.entries(cartRef.current)) {
      if (qty <= 0) continue;
      const dish = freshById.get(id);
      const cap =
        dish && dish.is_active && dish.portions_left > 0
          ? Math.min(qty, dish.portions_left)
          : 0;
      if (cap > 0) next[id] = cap;
      if (cap !== qty) {
        changed = true;
        if (dish && cap === 0) {
          toast.error(`${dish.name} was removed from your order`, {
            description: "It just sold out.",
          });
        } else if (dish && cap < qty) {
          toast.warning(`Only ${cap} × ${dish.name} left`, {
            description: "Your order was adjusted.",
          });
        }
      }
    }
    if (changed) setCart(next);
  }, [restaurant.id]);

  // My orders: ids live in localStorage so the strip survives reloads.
  const refetchMyOrders = useCallback(async () => {
    const ids = myOrderIdsRef.current;
    if (ids.length === 0) {
      setMyOrders([]);
      return;
    }
    const supabase = createClient();
    const orders = await getOrdersByIds(supabase, ids);

    for (const order of orders) {
      const prev = orderStatusRef.current.get(order.id);
      if (prev && prev !== order.status && STATUS_COPY[order.status]) {
        if (order.status === "served") {
          // the "food's here" moment deserves more than a toast
          chime([987.77, 1318.51]);
          if (typeof navigator !== "undefined") navigator.vibrate?.([120, 60, 120]);
        }
        toast.success(
          `Your order${order.tables ? ` for table ${order.tables.label}` : ""} is ${STATUS_COPY[order.status]}`
        );
      }
      orderStatusRef.current.set(order.id, order.status);
    }

    // paid orders leave the strip and the storage
    const active = orders.filter((o) => o.status !== "paid");
    const activeIds = active.map((o) => o.id);
    if (activeIds.length !== ids.length) {
      myOrderIdsRef.current = activeIds;
      localStorage.setItem(storageKey, JSON.stringify(activeIds));
    }
    setMyOrders(active);
  }, [storageKey, chime]);

  useEffect(() => {
    try {
      myOrderIdsRef.current = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    } catch {
      myOrderIdsRef.current = [];
    }
    refetchMyOrders();
  }, [storageKey, refetchMyOrders]);

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
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => refetchMyOrders()
      )
      // reset_demo bulk-DELETEs orders; DELETE payloads don't carry the
      // filter column, so this binding must stay unfiltered.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders" },
        () => refetchMyOrders()
      )
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
      // reset restores stock via a direct ingredients UPDATE (no stock_events)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ingredients",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        scheduleRefetch
      )
      // "*" so newly added dishes appear live, not just edits
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dishes" },
        scheduleRefetch
      )
      .subscribe((status) => {
        // catch up on anything missed while backgrounded/disconnected
        if (status === "SUBSCRIBED") {
          scheduleRefetch();
          refetchMyOrders();
        }
      });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, refetch, refetchMyOrders]);

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
    setSwapOutOf(null);
    setSwapLoading(true);
    const result = await suggestSwap(dish.id);
    setSwapLoading(false);
    if (result.ok && result.data) {
      setSwaps(result.data.suggestions);
      setSwapOutOf(result.data.outOf);
    } else if (!result.ok) setSwapError(result.error);
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
        description: "The kitchen has it — track it at the top of the menu.",
      });
      if (result.data) {
        myOrderIdsRef.current = [result.data.orderId, ...myOrderIdsRef.current];
        localStorage.setItem(storageKey, JSON.stringify(myOrderIdsRef.current));
        orderStatusRef.current.set(result.data.orderId, "placed");
        refetchMyOrders();
      }
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
            <Button size="sm" variant="outline" onClick={() => setReserveOpen(true)}>
              Reserve a table
            </Button>
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </div>
        </div>
      </header>

      {tableId && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            Table {tables.find((t) => t.id === tableId)?.label} · need something?
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={paging !== null}
            onClick={() => pageFloor("waiter")}
          >
            <BellRing className="h-3.5 w-3.5" />
            {paging === "waiter" ? "Paging…" : "Call waiter"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={paging !== null}
            onClick={() => pageFloor("bill")}
          >
            <ReceiptText className="h-3.5 w-3.5" />
            {paging === "bill" ? "Paging…" : "Get bill"}
          </Button>
        </div>
      )}

      {myOrders.length > 0 && (
        <section className="mt-4 space-y-1.5">
          {myOrders.map((order) => (
            <motion.div
              key={`${order.id}-${order.status}`}
              initial={{ opacity: 0.4, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 ${
                order.status === "served"
                  ? "border-green-600/30 dark:border-green-900/50 bg-green-500/8 dark:bg-green-950/15"
                  : "border-brass/25 bg-brass/5"
              }`}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                {order.status !== "served" && (
                  <span className="absolute h-full w-full animate-ping rounded-full bg-brass opacity-50" />
                )}
                <span
                  className={`relative h-2 w-2 rounded-full ${
                    order.status === "served" ? "bg-green-500" : "bg-brass"
                  }`}
                />
              </span>
              <p className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">
                  Your order{order.tables ? ` · Table ${order.tables.label}` : ""}
                </span>{" "}
                <span className="text-muted-foreground">
                  {order.order_items
                    .map((i) => `${i.dishes?.name} ×${i.qty}`)
                    .join(", ")}
                </span>
              </p>
              <Badge
                variant="outline"
                className={`shrink-0 font-mono ${ORDER_STATUS_BADGE[order.status]}`}
              >
                {order.status}
              </Badge>
              {order.status === "served" && !ratedIds.has(order.id) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setRateFor(order)}
                >
                  Rate ★
                </Button>
              )}
            </motion.div>
          ))}
        </section>
      )}

      <Dialog open={reserveOpen} onOpenChange={setReserveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reserve a table</DialogTitle>
            <DialogDescription>
              The restaurant sees your booking the moment you confirm.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitReservation} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-name">Name</Label>
              <Input
                id="res-name"
                required
                value={reserveForm.name}
                onChange={(e) => setReserveForm({ ...reserveForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="res-phone">Phone</Label>
                <Input
                  id="res-phone"
                  type="tel"
                  required
                  value={reserveForm.phone}
                  onChange={(e) => setReserveForm({ ...reserveForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="res-party">Party size</Label>
                <Input
                  id="res-party"
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={reserveForm.partySize}
                  onChange={(e) => setReserveForm({ ...reserveForm, partySize: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-time">When</Label>
              <Input
                id="res-time"
                type="datetime-local"
                required
                value={reserveForm.reservedAt}
                onChange={(e) => setReserveForm({ ...reserveForm, reservedAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-note">Note (optional)</Label>
              <Input
                id="res-note"
                placeholder="Window seat, birthday…"
                value={reserveForm.note}
                onChange={(e) => setReserveForm({ ...reserveForm, note: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={reserveBusy} className="w-full">
              {reserveBusy ? "Booking…" : "Confirm reservation"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rateFor !== null} onOpenChange={(open) => !open && setRateFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>How was it?</DialogTitle>
            <DialogDescription>
              Table {rateFor?.tables?.label ?? "—"} ·{" "}
              {rateFor?.order_items.map((i) => i.dishes?.name).join(", ")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`text-3xl transition-transform hover:scale-110 ${
                  star <= rating ? "text-brass" : "text-muted-foreground/30"
                }`}
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
              >
                ★
              </button>
            ))}
          </div>
          <Input
            placeholder="Anything to add? (optional)"
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
          />
          <Button onClick={submitRating} disabled={rating === 0} className="w-full">
            Submit rating
          </Button>
        </DialogContent>
      </Dialog>

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
                  className={`flex gap-3.5 rounded-lg border bg-card p-3 transition-all duration-700 ${
                    out
                      ? "opacity-50 saturate-0"
                      : "hover:border-brass/25 hover:shadow-[0_2px_16px_-8px_oklch(0.8_0.1_84/0.25)]"
                  }`}
                >
                  <DishThumb name={dish.name} img={dish.img} out={out} />

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
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
                    <span className="shrink-0 text-right">
                      <span
                        className={`font-mono text-sm tabular-nums ${
                          isSpecial(dish) ? "text-brass" : "text-muted-foreground"
                        }`}
                      >
                        {formatINR(dish.price)}
                      </span>
                      {isSpecial(dish) && (
                        <span className="block font-mono text-[11px] tabular-nums text-muted-foreground line-through">
                          {formatINR(dish.regular_price!)}
                        </span>
                      )}
                    </span>
                  </div>

                  {isSpecial(dish) && !out && (
                    <p className="mt-1.5 flex items-start gap-1 text-xs leading-snug text-brass">
                      <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{dish.special_note ?? "Chef's special — today only."}</span>
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <motion.div
                      key={dish.portions_left}
                      initial={{ opacity: 0.35, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    >
                      {out ? (
                        <Badge variant="destructive" className="font-mono">
                          86&apos;d — sold out
                        </Badge>
                      ) : state === "low" ? (
                        <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          Only {dish.portions_left} left
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {dish.portions_left} portions
                        </span>
                      )}
                    </motion.div>

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
                : swapOutOf
                  ? `The kitchen ran out of ${swapOutOf.toLowerCase()}. Closest available alternatives, from live stock:`
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
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
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
              <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-3xl overflow-y-auto">
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
