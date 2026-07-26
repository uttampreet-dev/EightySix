"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import {
  atRiskDishes,
  computeDayStats,
  formatEta,
  formatINR,
  formatTime,
  getDishRisk,
  getIngredients,
  getRecentEvents,
  getTodayOrders,
  restaurantHealth,
  RISK_ALERT_MINUTES,
  type DishRisk,
  type Ingredient,
  type LedgerEvent,
  type Restaurant,
  type TodayOrder,
} from "@/lib/engine";
import { getMorningBrief, interveneOnDish, planService } from "@/app/actions";
import { ChefHat, IndianRupee, Package, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ServicePlan = NonNullable<
  Extract<Awaited<ReturnType<typeof planService>>, { ok: true }>["data"]
>;
import { Sparkline } from "@/components/sparkline";
import { NumberTicker } from "@/components/number-ticker";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <div className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-md ${tint}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <CardTitle className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        <p className="font-serif text-[26px] font-medium leading-none tabular-nums">
          {value}
        </p>
        {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function OverviewClient({
  restaurant,
  initialOrders,
  initialIngredients,
  initialRisk,
  initialEvents,
}: {
  restaurant: Restaurant;
  initialOrders: TodayOrder[];
  initialIngredients: Ingredient[];
  initialRisk: DishRisk[];
  initialEvents: LedgerEvent[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [risk, setRisk] = useState(initialRisk);
  const [events, setEvents] = useState(initialEvents);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerDiners, setPlannerDiners] = useState("120");
  const [plannerBusy, setPlannerBusy] = useState(false);
  const [plan, setPlan] = useState<ServicePlan | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const alertedRef = useRef<Set<string>>(new Set());

  async function intervene(dishId: string, kind: "restock" | "kill") {
    setActing(dishId + kind);
    const result = await interveneOnDish(dishId, kind);
    setActing(null);
    if (result.ok && result.data) toast.success(result.data.summary);
    else if (!result.ok) toast.error(result.error);
    refetchRisk();
    refetchIngredients();
    refetchEvents();
  }

  async function runPlanner() {
    setPlannerBusy(true);
    const result = await planService(restaurant.id, Number(plannerDiners));
    setPlannerBusy(false);
    if (result.ok && result.data) setPlan(result.data);
    else if (!result.ok) toast.error(result.error);
  }

  const refetchOrders = useCallback(async () => {
    setOrders(await getTodayOrders(createClient(), restaurant.id));
  }, [restaurant.id]);
  const refetchIngredients = useCallback(async () => {
    setIngredients(await getIngredients(createClient(), restaurant.id));
  }, [restaurant.id]);
  const refetchEvents = useCallback(async () => {
    setEvents(await getRecentEvents(createClient(), restaurant.id));
  }, [restaurant.id]);
  const refetchRisk = useCallback(async () => {
    const fresh = await getDishRisk(createClient(), restaurant.id);
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
        alertedRef.current.delete(dish.id);
      }
    }
    setRisk(fresh);
  }, [restaurant.id]);

  // sliding 30-min velocity window moves even without events
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
      .channel(`overview-${restaurant.id}`)
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
          debounced("events", refetchEvents);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "dishes", filter: `restaurant_id=eq.${restaurant.id}` },
        () => debounced("risk", refetchRisk)
      )
      .subscribe();

    return () => {
      timers.forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, refetchOrders, refetchIngredients, refetchRisk, refetchEvents]);

  const stats = useMemo(() => computeDayStats(orders), [orders]);
  const lowCount = ingredients.filter(
    (i) => Number(i.stock_qty) <= Number(i.reorder_level)
  ).length;
  const dying = atRiskDishes(risk);
  const dead = risk.filter((d) => d.is_active && d.portions_left <= 0);
  const health = restaurantHealth(risk);

  async function loadBrief() {
    setBriefLoading(true);
    const result = await getMorningBrief(restaurant.id);
    setBriefLoading(false);
    if (result.ok && result.data) setBrief(result.data.brief);
    else if (!result.ok) toast.error(result.error);
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* live status — computed from the radar, never generated */}
      <motion.div
        layout
        className={`mt-6 flex items-center gap-4 rounded-xl border px-5 py-4 transition-colors duration-700 ${
          health.level === "critical"
            ? "border-red-900/60 bg-red-950/25"
            : health.level === "watch"
              ? "border-amber-800/50 bg-amber-950/15"
              : "border-green-900/50 bg-green-950/15"
        }`}
      >
        <span className="relative flex h-3 w-3 shrink-0">
          <span
            className={`absolute h-full w-full animate-ping rounded-full opacity-50 ${
              health.level === "critical"
                ? "bg-red-500"
                : health.level === "watch"
                  ? "bg-amber-400"
                  : "bg-green-500"
            }`}
          />
          <span
            className={`relative h-3 w-3 rounded-full ${
              health.level === "critical"
                ? "bg-red-500"
                : health.level === "watch"
                  ? "bg-amber-400"
                  : "bg-green-500"
            }`}
          />
        </span>
        <div className="min-w-0">
          <p
            className={`font-mono text-[10px] uppercase tracking-[0.22em] ${
              health.level === "critical"
                ? "text-red-400"
                : health.level === "watch"
                  ? "text-amber-400"
                  : "text-green-500"
            }`}
          >
            {health.label}
          </p>
          <p className="mt-0.5 font-serif text-lg leading-snug">{health.headline}</p>
        </div>
      </motion.div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Revenue today"
          icon={IndianRupee}
          tint="bg-brass/15 text-brass"
          value={<NumberTicker value={stats.revenue} format={formatINR} />}
        />
        <StatCard
          label="Orders today"
          icon={ReceiptText}
          tint="bg-[#3987e5]/15 text-[#6aa5ec]"
          value={<NumberTicker value={stats.orderCount} />}
          hint={`${orders.filter((o) => o.status === "placed" || o.status === "cooking").length} in progress`}
        />
        <StatCard
          label="Top dish"
          icon={ChefHat}
          tint="bg-green-500/15 text-green-500"
          value={
            <span className="text-xl leading-tight">
              {stats.topDishes[0]?.name ?? "—"}
            </span>
          }
          hint={stats.topDishes[0] ? `${stats.topDishes[0].qty} portions` : "No orders yet"}
        />
        <StatCard
          label="Low / out stock"
          icon={Package}
          tint="bg-amber-500/15 text-amber-400"
          value={<NumberTicker value={lowCount} />}
          hint={`of ${ingredients.length} ingredients`}
        />
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
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
            <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              86-risk radar
            </h2>
            <Button size="sm" variant="outline" onClick={() => setPlannerOpen(true)}>
              Plan a service
            </Button>
          </div>

          {dying.filter((d) => d.minutes_to_86! <= RISK_ALERT_MINUTES).length > 0 && (
            <div className="mb-3 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3">
              <p className="text-sm font-medium text-red-400">
                {dying.filter((d) => d.minutes_to_86! <= RISK_ALERT_MINUTES).length}{" "}
                dish(es) predicted to 86 within {RISK_ALERT_MINUTES} minutes — prep
                more or push alternatives.
              </p>
            </div>
          )}

          {dying.length === 0 && dead.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No dishes at risk right now.
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Press{" "}
                <span className="font-medium text-foreground">
                  Simulate dinner rush
                </span>{" "}
                ↑ and watch predictions light up as order velocity builds.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {dying.map((dish) => {
                  const mins = dish.minutes_to_86!;
                  const level =
                    mins <= RISK_ALERT_MINUTES ? "critical" : mins <= 90 ? "warm" : "calm";
                  return (
                    <motion.div
                      key={dish.id}
                      layout
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
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
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge
                          variant={level === "critical" ? "destructive" : "outline"}
                          className={`font-mono tabular-nums ${
                            level === "warm" ? "border-amber-500/40 text-amber-400" : ""
                          }`}
                        >
                          86 in {formatEta(mins)}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs text-brass"
                          disabled={acting === dish.id + "restock"}
                          onClick={() => intervene(dish.id, "restock")}
                          title="Restock the scarcest ingredient — quantity computed to cover ~2h at current pace"
                        >
                          {acting === dish.id + "restock" ? "…" : "Prep"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs text-red-400"
                          disabled={acting === dish.id + "kill"}
                          onClick={() => intervene(dish.id, "kill")}
                          title="Strike it from every menu now"
                        >
                          86
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
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
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
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

          <h2 className="mb-3 mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Live ledger
          </h2>
          {events.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
              Every stock movement lands here — orders depleting ingredients,
              kitchen markdowns, restocks — a live audit trail.
            </p>
          ) : (
            <div className="space-y-1 overflow-hidden">
              <AnimatePresence initial={false}>
                {events.slice(0, 10).map((event) => {
                  const delta = Number(event.delta);
                  return (
                    <motion.div
                      key={event.id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35 }}
                      className="flex items-center gap-2.5 rounded-md border border-border/60 bg-white/1.5 px-3 py-1.5 font-mono text-[11px]"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          event.reason === "prep" || delta > 0
                            ? "bg-brass"
                            : event.reason === "manual"
                              ? "bg-amber-400"
                              : "bg-muted-foreground/50"
                        }`}
                      />
                      <span className="text-muted-foreground">
                        {formatTime(event.created_at)}
                      </span>
                      <span className="truncate">
                        {event.ingredients?.name ?? "—"}{" "}
                        <span className={delta > 0 ? "text-brass" : "text-muted-foreground"}>
                          {delta > 0 ? "+" : ""}
                          {delta.toFixed(2)} {event.ingredients?.unit}
                        </span>
                      </span>
                      <span className="ml-auto shrink-0 text-muted-foreground/60">
                        {event.reason}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button asChild size="sm" variant="outline" className="flex-1">
              <Link href="/dashboard/prep">Prep sheet</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="flex-1">
              <Link href="/dashboard/analytics">Analytics</Link>
            </Button>
          </div>
        </section>
      </div>

      <Dialog open={plannerOpen} onOpenChange={setPlannerOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Plan a service</DialogTitle>
            <DialogDescription>
              A deterministic what-if: expected orders are distributed by dish
              popularity and walked through the recipe graph against live stock —
              no guesswork, every number is computed.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Expected diners</p>
              <Input
                type="number"
                min="1"
                max="1000"
                value={plannerDiners}
                onChange={(e) => setPlannerDiners(e.target.value)}
                className="w-32 tabular-nums"
              />
            </div>
            <Button onClick={runPlanner} disabled={plannerBusy}>
              {plannerBusy ? "Computing…" : "Run the numbers"}
            </Button>
          </div>

          {plan && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-card p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Projected revenue
                  </p>
                  <p className="mt-1 font-serif text-2xl tabular-nums text-green-500">
                    {formatINR(plan.projectedRevenue)}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Lost to stockouts
                  </p>
                  <p className="mt-1 font-serif text-2xl tabular-nums text-red-400">
                    {formatINR(plan.lostRevenue)}
                  </p>
                </div>
              </div>

              {plan.dishes.filter((d) => d.diesAtCover !== null).length > 0 ? (
                <div>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Dishes that die at this volume
                  </p>
                  <div className="space-y-1">
                    {plan.dishes
                      .filter((d) => d.diesAtCover !== null)
                      .map((d) => (
                        <div
                          key={d.name}
                          className="flex items-center justify-between rounded-md border border-red-900/50 bg-red-950/20 px-3 py-1.5 text-sm"
                        >
                          <span>{d.name}</span>
                          <span className="font-mono text-xs text-red-400">
                            dies after {d.diesAtCover} of {d.expected} expected
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-green-900/50 bg-green-950/15 px-3 py-2 text-sm text-green-500">
                  Stock survives the whole service — every expected order can be
                  served.
                </p>
              )}

              {plan.shortfalls.length > 0 && (
                <div>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Buy before service
                  </p>
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ingredient</TableHead>
                          <TableHead className="text-right">Have</TableHead>
                          <TableHead className="text-right">Buy</TableHead>
                          <TableHead className="text-right">Est. cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plan.shortfalls.map((s) => (
                          <TableRow key={s.name}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {s.have} {s.unit}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums text-brass">
                              +{s.buy} {s.unit}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatINR(s.cost)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
