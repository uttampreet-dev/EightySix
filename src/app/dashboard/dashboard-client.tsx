"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  atRiskDishes,
  computeDayStats,
  formatEta,
  formatINR,
  getDishRisk,
  getIngredients,
  getTables,
  getTodayOrders,
  orderTotal,
  RISK_ALERT_MINUTES,
  type DishRisk,
  type Ingredient,
  type OrderStatus,
  type Restaurant,
  type RestaurantTable,
  type TodayOrder,
} from "@/lib/engine";
import {
  bumpOrderStatus,
  getMorningBrief,
  toggleTableStatus,
  updateIngredient,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Sparkline } from "@/components/sparkline";
import { SignOutButton } from "@/components/sign-out-button";

const NEXT_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  placed: { to: "cooking", label: "Start cooking" },
  cooking: { to: "served", label: "Mark served" },
  served: { to: "paid", label: "Mark paid" },
};

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function IngredientRow({ ingredient }: { ingredient: Ingredient }) {
  const [stock, setStock] = useState(String(ingredient.stock_qty));
  const [reorder, setReorder] = useState(String(ingredient.reorder_level));
  const [saving, setSaving] = useState(false);

  // Sync inputs when a realtime update changes the row underneath us.
  const [lastServer, setLastServer] = useState({
    stock: ingredient.stock_qty,
    reorder: ingredient.reorder_level,
  });
  if (
    lastServer.stock !== ingredient.stock_qty ||
    lastServer.reorder !== ingredient.reorder_level
  ) {
    setLastServer({ stock: ingredient.stock_qty, reorder: ingredient.reorder_level });
    setStock(String(ingredient.stock_qty));
    setReorder(String(ingredient.reorder_level));
  }

  const dirty =
    Number(stock) !== Number(ingredient.stock_qty) ||
    Number(reorder) !== Number(ingredient.reorder_level);
  const out = Number(ingredient.stock_qty) <= 0;
  const low = !out && Number(ingredient.stock_qty) <= Number(ingredient.reorder_level);

  async function save() {
    setSaving(true);
    const result = await updateIngredient(ingredient.id, {
      stockQty: Number(stock),
      reorderLevel: Number(reorder),
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else toast.success(`${ingredient.name} updated`);
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{ingredient.name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.1"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="h-8 w-24 tabular-nums"
          />
          <span className="text-xs text-muted-foreground">{ingredient.unit}</span>
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.1"
          min="0"
          value={reorder}
          onChange={(e) => setReorder(e.target.value)}
          className="h-8 w-20 tabular-nums"
        />
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">
        {formatINR(ingredient.cost_per_unit)}/{ingredient.unit}
      </TableCell>
      <TableCell>
        {out ? (
          <Badge variant="destructive">Out</Badge>
        ) : low ? (
          <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-400">Low</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">OK</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="secondary" disabled={!dirty || saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function DashboardClient({
  restaurant,
  initialOrders,
  initialIngredients,
  initialTables,
  initialRisk,
  userEmail,
}: {
  restaurant: Restaurant;
  initialOrders: TodayOrder[];
  initialIngredients: Ingredient[];
  initialTables: RestaurantTable[];
  initialRisk: DishRisk[];
  userEmail: string;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [tables, setTables] = useState(initialTables);
  const [risk, setRisk] = useState(initialRisk);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const alertedRef = useRef<Set<string>>(new Set());

  const refetchOrders = useCallback(async () => {
    setOrders(await getTodayOrders(createClient(), restaurant.id));
  }, [restaurant.id]);
  const refetchIngredients = useCallback(async () => {
    setIngredients(await getIngredients(createClient(), restaurant.id));
  }, [restaurant.id]);
  const refetchTables = useCallback(async () => {
    setTables(await getTables(createClient(), restaurant.id));
  }, [restaurant.id]);
  const refetchRisk = useCallback(async () => {
    const fresh = await getDishRisk(createClient(), restaurant.id);
    // Alert once per dish when its predicted death crosses the threshold.
    for (const dish of atRiskDishes(fresh)) {
      if (
        dish.minutes_to_86! <= RISK_ALERT_MINUTES &&
        !alertedRef.current.has(dish.id)
      ) {
        alertedRef.current.add(dish.id);
        toast.warning(`${dish.name}: 86 in ${formatEta(dish.minutes_to_86!)}`, {
          description: `${dish.portions_left} portions left at current pace.`,
        });
      }
    }
    for (const dish of fresh) {
      if (dish.minutes_to_86 === null && alertedRef.current.has(dish.id)) {
        alertedRef.current.delete(dish.id); // recovered — re-arm the alert
      }
    }
    setRisk(fresh);
  }, [restaurant.id]);

  // Velocity is a sliding 30-min window: it changes with time even without
  // new events, so recompute every 60s on top of realtime triggers.
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
      .channel(`dashboard-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` },
        () => debounced("orders", refetchOrders)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stock_events", filter: `restaurant_id=eq.${restaurant.id}` },
        () => {
          debounced("ingredients", refetchIngredients);
          debounced("risk", refetchRisk);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ingredients", filter: `restaurant_id=eq.${restaurant.id}` },
        () => debounced("ingredients", refetchIngredients)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tables", filter: `restaurant_id=eq.${restaurant.id}` },
        () => debounced("tables", refetchTables)
      )
      .subscribe();

    return () => {
      timers.forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, refetchOrders, refetchIngredients, refetchTables, refetchRisk]);

  const stats = useMemo(() => computeDayStats(orders), [orders]);
  const lowCount = ingredients.filter(
    (i) => Number(i.stock_qty) <= Number(i.reorder_level)
  ).length;

  async function bump(order: TodayOrder) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    const result = await bumpOrderStatus(order.id, next.to);
    if (!result.ok) toast.error(result.error);
    refetchOrders();
  }

  async function toggleTable(table: RestaurantTable) {
    const result = await toggleTableStatus(table.id);
    if (!result.ok) toast.error(result.error);
    refetchTables();
  }

  async function loadBrief() {
    setBriefLoading(true);
    const result = await getMorningBrief(restaurant.id);
    setBriefLoading(false);
    if (result.ok && result.data) setBrief(result.data.brief);
    else if (!result.ok) toast.error(result.error);
  }

  const dying = atRiskDishes(risk);
  const dead = risk.filter((d) => d.portions_left <= 0);
  const critical = dying.filter((d) => d.minutes_to_86! <= RISK_ALERT_MINUTES);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16">
      <Toaster position="top-center" richColors />

      <header className="sticky top-0 z-10 -mx-4 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{restaurant.name}</h1>
            <p className="text-xs text-muted-foreground">
              Owner dashboard · {userEmail}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/r/${restaurant.slug}`}>Menu</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/kitchen">Kitchen</Link>
            </Button>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Revenue today" value={formatINR(stats.revenue)} />
        <StatCard
          label="Orders today"
          value={String(stats.orderCount)}
          hint={`${orders.filter((o) => o.status === "placed" || o.status === "cooking").length} in progress`}
        />
        <StatCard
          label="Top dish"
          value={stats.topDishes[0]?.name ?? "—"}
          hint={stats.topDishes[0] ? `${stats.topDishes[0].qty} portions` : "No orders yet"}
        />
        <StatCard
          label="Low / out stock"
          value={String(lowCount)}
          hint={`of ${ingredients.length} ingredients`}
        />
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Orders per hour
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <Sparkline
              points={stats.perHour}
              labelFor={(p) =>
                `${String(p.hour).padStart(2, "0")}:00 — ${p.count} order${p.count === 1 ? "" : "s"}`
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_380px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              86-risk radar
            </h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/prep">Tomorrow&apos;s prep sheet</Link>
            </Button>
          </div>

          {critical.length > 0 && (
            <div className="mb-3 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3">
              <p className="text-sm font-medium text-red-400">
                {critical.length} dish{critical.length > 1 ? "es" : ""} predicted to 86
                within {RISK_ALERT_MINUTES} minutes — prep more or push alternatives.
              </p>
            </div>
          )}

          {dying.length === 0 && dead.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No dishes at risk. Predictions appear as soon as orders build up
              velocity.
            </p>
          ) : (
            <div className="space-y-1.5">
              {dying.map((dish) => {
                const mins = dish.minutes_to_86!;
                const level =
                  mins <= RISK_ALERT_MINUTES ? "critical" : mins <= 90 ? "warm" : "calm";
                return (
                  <div
                    key={dish.id}
                    className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                      level === "critical"
                        ? "border-red-900/60 bg-red-950/30"
                        : level === "warm"
                          ? "border-amber-800/50 bg-amber-950/20"
                          : "bg-card"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{dish.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dish.portions_left} left · {dish.velocity_30min}/30min pace
                      </p>
                    </div>
                    <Badge
                      variant={level === "critical" ? "destructive" : "outline"}
                      className={`shrink-0 font-mono tabular-nums ${
                        level === "warm" ? "border-amber-500/40 text-amber-400" : ""
                      }`}
                    >
                      86 in {formatEta(mins)}
                    </Badge>
                  </div>
                );
              })}
              {dead.map((dish) => (
                <div
                  key={dish.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 opacity-60"
                >
                  <p className="truncate text-sm font-medium">{dish.name}</p>
                  <Badge variant="destructive" className="shrink-0 font-mono">
                    86&apos;d
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Manager brief
          </h2>
          <Card className="gap-3 py-4">
            <CardContent className="px-4">
              {brief ? (
                <div className="space-y-2 text-sm leading-relaxed">
                  {brief
                    .split("\n")
                    .filter((line) => line.trim())
                    .map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  A Gemini-written read on today: risks, what to prep, what to
                  push — grounded in live orders and stock.
                </p>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="mt-4 w-full"
                disabled={briefLoading}
                onClick={loadBrief}
              >
                {briefLoading ? "Reading the room…" : brief ? "Refresh brief" : "Generate brief"}
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>

      <Tabs defaultValue="orders" className="mt-8">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          {orders.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No orders yet today.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {orders.map((order) => {
                const next = NEXT_STATUS[order.status];
                return (
                  <Card key={order.id} className="gap-3 py-4">
                    <CardHeader className="px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
                          Table {order.tables?.label ?? "—"} ·{" "}
                          {new Date(order.created_at).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </CardTitle>
                        <Badge
                          variant={
                            order.status === "paid"
                              ? "outline"
                              : order.status === "placed"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {order.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4">
                      <ul className="space-y-1 text-sm">
                        {order.order_items.map((item) => (
                          <li key={item.id} className="flex justify-between">
                            <span>
                              {item.dishes?.name ?? "Unknown"} × {item.qty}
                            </span>
                            <span className="text-muted-foreground">
                              {formatINR((item.dishes?.price ?? 0) * item.qty)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-medium">
                        <span>Total</span>
                        <span className="tabular-nums">{formatINR(orderTotal(order))}</span>
                      </div>
                      {next && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="mt-3 w-full"
                          onClick={() => bump(order)}
                        >
                          {next.label}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Reorder at</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ingredient) => (
                  <IngredientRow key={ingredient.id} ingredient={ingredient} />
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="tables" className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {tables.map((table) => (
              <button
                key={table.id}
                onClick={() => toggleTable(table)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  table.status === "occupied"
                    ? "border-amber-800/50 bg-amber-950/20"
                    : "bg-card hover:bg-accent"
                }`}
              >
                <p className="font-medium">Table {table.label}</p>
                <p className="text-xs text-muted-foreground">{table.seats} seats</p>
                <Badge
                  variant={table.status === "occupied" ? "default" : "outline"}
                  className="mt-2"
                >
                  {table.status}
                </Badge>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tap a table to toggle free / occupied.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
