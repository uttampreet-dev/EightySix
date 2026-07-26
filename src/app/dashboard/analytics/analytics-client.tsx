"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  computeAnalytics,
  formatINR,
  getOrdersSince,
  orderTotal,
  type Restaurant,
  type TodayOrder,
} from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NumberTicker } from "@/components/number-ticker";

// Validated single-series hue for dark surfaces.
const SERIES = "#3987e5";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <CardTitle className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </CardTitle>
  );
}

function DayBars({
  data,
}: {
  data: { label: string; revenue: number; orders: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  return (
    <div className="flex h-40 items-end gap-3">
      {data.map((d, i) => {
        const h = (d.revenue / max) * 100;
        const isMax = d.revenue === max && d.revenue > 0;
        return (
          <div
            key={i}
            className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            title={`${d.label}: ${formatINR(d.revenue)} · ${d.orders} orders`}
          >
            {isMax && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {formatINR(d.revenue)}
              </span>
            )}
            <div
              className="w-full max-w-9 rounded-t-lg transition-opacity group-hover:opacity-80"
              style={{
                height: `${Math.max(h, d.revenue > 0 ? 3 : 1)}%`,
                background: d.revenue > 0 ? SERIES : "oklch(0.95 0.03 85 / 0.08)",
              }}
            />
            <span className="font-mono text-[10px] text-muted-foreground">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function CategoryBars({
  data,
}: {
  data: { category: string; revenue: number; share: number }[];
}) {
  return (
    <div className="space-y-2.5">
      {data.map((c) => (
        <div key={c.category}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate">{c.category}</span>
            <span className="shrink-0 font-mono text-muted-foreground">
              {formatINR(c.revenue)} · {Math.round(c.share * 100)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full"
              style={{ width: `${c.share * 100}%`, background: SERIES }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function HourStrip({ data }: { data: { hour: number; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="flex h-16 items-end gap-0.75">
        {data.map((d) => (
          <div
            key={d.hour}
            className="flex-1 rounded-t-[3px]"
            title={`${String(d.hour).padStart(2, "0")}:00 — ${d.count} orders`}
            style={{
              height: `${Math.max((d.count / max) * 100, d.count > 0 ? 6 : 2)}%`,
              background: d.count > 0 ? SERIES : "oklch(0.95 0.03 85 / 0.08)",
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </div>
  );
}

export function AnalyticsClient({
  restaurant,
  initialOrders,
}: {
  restaurant: Restaurant;
  initialOrders: TodayOrder[];
}) {
  const [orders, setOrders] = useState(initialOrders);

  const refetch = useCallback(async () => {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);
    setOrders(await getOrdersSince(createClient(), restaurant.id, since.toISOString()));
  }, [restaurant.id]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`analytics-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(refetch, 500);
        }
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, refetch]);

  const analytics = useMemo(() => computeAnalytics(orders), [orders]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">Analytics</h1>
          <p className="text-xs text-muted-foreground">
            Last 7 days · computed live from real orders — updates as they happen
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const rows = [
              ["order_id", "placed_at", "table", "status", "items", "total_inr"],
              ...orders.map((o) => [
                o.id,
                o.created_at,
                o.tables?.label ?? "",
                o.status,
                o.order_items
                  .map((i) => `${i.dishes?.name ?? "?"} x${i.qty}`)
                  .join("; "),
                String(orderTotal(o)),
              ]),
            ];
            const csv = rows
              .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
              .join("\n");
            const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "eightysix-orders-7d.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export CSV
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Revenue (7d)",
            value: <NumberTicker value={analytics.totals.revenue} format={formatINR} />,
          },
          {
            label: "Orders (7d)",
            value: <NumberTicker value={analytics.totals.orders} />,
          },
          {
            label: "Avg order value",
            value: <NumberTicker value={analytics.totals.avgOrder} format={formatINR} />,
          },
        ].map((stat) => (
          <Card key={stat.label} className="gap-2 py-4">
            <CardHeader className="px-4">
              <SectionTitle>{stat.label}</SectionTitle>
            </CardHeader>
            <CardContent className="px-4">
              <p className="font-serif text-[26px] font-medium leading-none tabular-nums">
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <SectionTitle>Revenue by day</SectionTitle>
          </CardHeader>
          <CardContent className="px-4">
            <DayBars data={analytics.perDay} />
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <SectionTitle>Revenue by category</SectionTitle>
          </CardHeader>
          <CardContent className="px-4">
            {analytics.byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <CategoryBars data={analytics.byCategory} />
            )}
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <SectionTitle>Orders by hour of day</SectionTitle>
          </CardHeader>
          <CardContent className="px-4">
            <HourStrip data={analytics.byHour} />
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <SectionTitle>Top dishes</SectionTitle>
          </CardHeader>
          <CardContent className="px-0">
            {analytics.topDishes.length === 0 ? (
              <p className="px-4 text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Dish</TableHead>
                    <TableHead className="text-right">Portions</TableHead>
                    <TableHead className="pr-4 text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.topDishes.map((dish) => (
                    <TableRow key={dish.name}>
                      <TableCell className="pl-4 font-medium">{dish.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{dish.qty}</TableCell>
                      <TableCell className="pr-4 text-right tabular-nums text-muted-foreground">
                        {formatINR(dish.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
