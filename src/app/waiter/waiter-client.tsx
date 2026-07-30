"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { BellRing, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  atRiskDishes,
  formatEta,
  formatTime,
  getDishRisk,
  getOpenOrders,
  getOpenServiceCalls,
  getReservations,
  getTables,
  isSpecial,
  type DishRisk,
  type OrderWithItems,
  type Reservation,
  type Restaurant,
  type RestaurantTable,
  type ServiceCall,
} from "@/lib/engine";
import { resolveServiceCall, toggleTableStatus } from "@/app/actions";
import { useChime } from "@/lib/use-chime";
import { ORDER_STATUS_BADGE } from "@/lib/status-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { SignOutButton } from "@/components/sign-out-button";

// The floor runs on a brighter, higher tone than the kitchen pass.
const CALL_CHIME = [987.77, 1318.51];

function callAge(createdAt: string, now: number): string {
  const mins = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
  return mins === 0 ? "just now" : `${mins}m`;
}

export function WaiterClient({
  restaurant,
  initialTables,
  initialOrders,
  initialRisk,
  initialReservations,
  initialCalls,
}: {
  restaurant: Restaurant;
  initialTables: RestaurantTable[];
  initialOrders: OrderWithItems[];
  initialRisk: DishRisk[];
  initialReservations: Reservation[];
  initialCalls: ServiceCall[];
}) {
  const [tables, setTables] = useState(initialTables);
  const [orders, setOrders] = useState(initialOrders);
  const [risk, setRisk] = useState(initialRisk);
  const [reservations, setReservations] = useState(initialReservations);
  const [calls, setCalls] = useState(initialCalls);
  const [now, setNow] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);
  const chime = useChime();

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t0 = setTimeout(tick, 0); // first paint after hydration
    const t = setInterval(tick, 15000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);

  const refetchTables = useCallback(async () => {
    setTables(await getTables(createClient(), restaurant.id));
  }, [restaurant.id]);
  const refetchOrders = useCallback(async () => {
    setOrders(await getOpenOrders(createClient(), restaurant.id));
  }, [restaurant.id]);
  const refetchRisk = useCallback(async () => {
    setRisk(await getDishRisk(createClient(), restaurant.id));
  }, [restaurant.id]);
  const refetchReservations = useCallback(async () => {
    setReservations(await getReservations(createClient(), restaurant.id));
  }, [restaurant.id]);
  const refetchCalls = useCallback(async () => {
    setCalls(await getOpenServiceCalls(createClient(), restaurant.id));
  }, [restaurant.id]);

  // the risk window slides with time even when no events arrive
  useEffect(() => {
    const t = setInterval(refetchRisk, 60000);
    return () => clearInterval(t);
  }, [refetchRisk]);

  useEffect(() => {
    const supabase = createClient();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const debounced = (key: string, fn: () => void) => {
      const t = timers.get(key);
      if (t) clearTimeout(t);
      timers.set(key, setTimeout(fn, 300));
    };

    const channel = supabase
      .channel(`waiter-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "service_calls", filter: `restaurant_id=eq.${restaurant.id}` },
        (payload) => {
          const kind = (payload.new as { kind?: string }).kind;
          if (soundRef.current) chime(CALL_CHIME);
          toast.warning(kind === "bill" ? "A table wants the bill" : "A table is calling", {
            description: "Check the calls strip.",
          });
          debounced("calls", refetchCalls);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "service_calls", filter: `restaurant_id=eq.${restaurant.id}` },
        () => debounced("calls", refetchCalls)
      )
      // reset_demo bulk-DELETEs rows; DELETE payloads don't carry the
      // filter column, so these bindings stay unfiltered on purpose.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "service_calls" },
        () => debounced("calls", refetchCalls)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          debounced("orders", refetchOrders);
          debounced("tables", refetchTables);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tables", filter: `restaurant_id=eq.${restaurant.id}` },
        () => debounced("tables", refetchTables)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stock_events", filter: `restaurant_id=eq.${restaurant.id}` },
        () => debounced("risk", refetchRisk)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dishes" },
        () => debounced("risk", refetchRisk)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        () => debounced("reservations", refetchReservations)
      )
      .subscribe((status) => {
        // catch up on anything missed while disconnected (sleep, wifi blip)
        if (status === "SUBSCRIBED") {
          refetchCalls();
          refetchOrders();
          refetchTables();
          refetchRisk();
          refetchReservations();
        }
      });

    return () => {
      timers.forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, chime, refetchCalls, refetchOrders, refetchTables, refetchRisk, refetchReservations]);

  async function resolveCall(call: ServiceCall) {
    setCalls((c) => c.filter((x) => x.id !== call.id));
    const result = await resolveServiceCall(call.id);
    if (!result.ok) {
      toast.error(result.error);
      refetchCalls();
    }
  }

  async function toggleTable(table: RestaurantTable) {
    const result = await toggleTableStatus(table.id);
    if (!result.ok) toast.error(result.error);
    refetchTables();
  }

  const ordersByTable = useMemo(() => {
    const map = new Map<string, OrderWithItems[]>();
    for (const order of orders) {
      if (!order.table_id) continue;
      if (!map.has(order.table_id)) map.set(order.table_id, []);
      map.get(order.table_id)!.push(order);
    }
    return map;
  }, [orders]);

  // parties booked for the next ~2 hours (or running late) that still need seating
  const dueSoon = useMemo(() => {
    const nowMs = now ?? 0;
    return reservations.filter((r) => {
      if (r.status !== "booked") return false;
      const at = new Date(r.reserved_at).getTime();
      return at < nowMs + 2 * 3600_000 && at > nowMs - 3600_000;
    });
  }, [reservations, now]);

  const dying = atRiskDishes(risk).filter((d) => d.minutes_to_86! <= 90);
  const dead = risk.filter((d) => d.is_active && d.portions_left <= 0);
  const specials = risk.filter((d) => d.is_active && isSpecial(d) && d.portions_left > 0);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12">
      <Toaster position="top-center" richColors />

      <header className="sticky top-0 z-10 -mx-4 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight">Floor</h1>
            <p className="text-xs text-muted-foreground">{restaurant.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {calls.length} open call{calls.length === 1 ? "" : "s"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                soundRef.current = !soundRef.current;
                setSoundOn(soundRef.current);
                if (soundRef.current) chime(CALL_CHIME);
              }}
            >
              {soundOn ? "Sound on" : "Muted"}
            </Button>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* diner pings — the most urgent thing on the floor */}
      {calls.length > 0 && (
        <section className="mt-4 space-y-1.5">
          <AnimatePresence initial={false}>
            {calls.map((call) => (
              <motion.div
                key={call.id}
                layout
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className="flex items-center gap-3 rounded-lg border border-brass/40 bg-brass/10 px-4 py-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brass/20 text-brass">
                  {call.kind === "bill" ? (
                    <ReceiptText className="h-4 w-4" />
                  ) : (
                    <BellRing className="h-4 w-4" />
                  )}
                </span>
                <p className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">Table {call.tables?.label ?? "—"}</span>{" "}
                  <span className="text-muted-foreground">
                    {call.kind === "bill" ? "wants the bill" : "is calling a waiter"}
                    {now !== null && ` · ${callAge(call.created_at, now)}`}
                  </span>
                </p>
                <Button size="sm" variant="secondary" onClick={() => resolveCall(call)}>
                  On it
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
      )}

      {/* what the kitchen knows before the diner asks */}
      {(dead.length > 0 || dying.length > 0 || specials.length > 0) && (
        <section className="mt-5">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Before they order
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {dead.map((d) => (
              <Badge key={d.id} variant="destructive" className="font-mono">
                {d.name} · 86&apos;d
              </Badge>
            ))}
            {dying.map((d) => (
              <Badge
                key={d.id}
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 font-mono text-amber-600 dark:text-amber-400"
              >
                {d.name} · 86 in {formatEta(d.minutes_to_86!)}
              </Badge>
            ))}
            {specials.map((d) => (
              <Badge
                key={d.id}
                variant="outline"
                className="border-brass/40 bg-brass/10 font-mono text-brass"
              >
                Push: {d.name} ₹{d.price}
                {d.regular_price !== null && (
                  <span className="ml-1 line-through opacity-60">₹{d.regular_price}</span>
                )}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Floor map
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {tables.map((table) => {
              const tableOrders = ordersByTable.get(table.id) ?? [];
              const latest = tableOrders[tableOrders.length - 1];
              const occupied = table.status === "occupied";
              return (
                <div
                  key={table.id}
                  className={`flex min-h-28 flex-col rounded-lg border p-3 transition-colors ${
                    occupied ? "border-brass/30 bg-brass/5" : "bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-lg font-medium">{table.label}</span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        occupied ? "bg-brass" : "bg-green-500/70"
                      }`}
                      title={occupied ? "Occupied" : "Free"}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {table.seats} seats · {occupied ? "occupied" : "free"}
                  </p>
                  <div className="mt-2 flex-1 space-y-1">
                    {latest && (
                      <div className="rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <Badge
                            variant="outline"
                            className={`h-4 px-1 font-mono text-[9px] ${ORDER_STATUS_BADGE[latest.status]}`}
                          >
                            {latest.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {now !== null && callAge(latest.created_at, now)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          {latest.order_items
                            .map((i) => `${i.dishes?.name} ×${i.qty}`)
                            .join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 h-6 self-start px-1.5 text-[11px] text-muted-foreground"
                    onClick={() => toggleTable(table)}
                  >
                    {occupied ? "Mark free" : "Seat walk-in"}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Arriving soon
          </h2>
          {dueSoon.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
              No parties due in the next two hours. Bookings made on the diner
              menu land here the moment they&apos;re confirmed.
            </p>
          ) : (
            <div className="space-y-1.5">
              {dueSoon.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border bg-card px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <span className="shrink-0 font-mono text-xs text-brass">
                      {formatTime(r.reserved_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Party of {r.party_size}
                    {r.tables?.label ? ` · Table ${r.tables.label}` : " · unassigned"}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          <h2 className="mb-3 mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Open orders
          </h2>
          {orders.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
              Nothing in flight. Orders appear here the second a diner places
              one — serve them as the kitchen marks them ready.
            </p>
          ) : (
            <div className="space-y-1.5">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2"
                >
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">
                      {order.tables ? `Table ${order.tables.label}` : "Takeaway"}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {order.order_items.reduce((s, i) => s + i.qty, 0)} items
                    </span>
                  </p>
                  <Badge
                    variant="outline"
                    className={`shrink-0 font-mono ${ORDER_STATUS_BADGE[order.status]}`}
                  >
                    {order.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
