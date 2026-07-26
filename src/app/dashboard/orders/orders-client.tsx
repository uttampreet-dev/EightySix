"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import {
  formatINR,
  formatTime,
  getTodayOrders,
  orderTotal,
  type OrderStatus,
  type Restaurant,
  type TodayOrder,
} from "@/lib/engine";
import { bumpOrderStatus } from "@/app/actions";
import { ORDER_STATUS_BADGE, ORDER_STATUS_DOT } from "@/lib/status-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const NEXT_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  placed: { to: "cooking", label: "Start cooking" },
  cooking: { to: "served", label: "Mark served" },
};

export function OrdersClient({
  restaurant,
  initialOrders,
}: {
  restaurant: Restaurant;
  initialOrders: TodayOrder[];
}) {
  const [orders, setOrders] = useState(initialOrders);

  const refetch = useCallback(async () => {
    setOrders(await getTodayOrders(createClient(), restaurant.id));
  }, [restaurant.id]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`orders-page-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(refetch, 300);
        }
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, refetch]);

  async function bump(order: TodayOrder, to: OrderStatus) {
    const result = await bumpOrderStatus(order.id, to);
    if (!result.ok) toast.error(result.error);
    refetch();
  }

  const columns: { status: OrderStatus; label: string }[] = [
    { status: "placed", label: "Placed" },
    { status: "cooking", label: "Cooking" },
    { status: "served", label: "Served — to bill" },
    { status: "paid", label: "Paid" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-medium tracking-tight">Orders</h1>
        <div className="flex flex-wrap gap-1.5">
          {columns.map((column) => (
            <Badge
              key={column.status}
              variant="outline"
              className={`font-mono ${ORDER_STATUS_BADGE[column.status]}`}
            >
              {orders.filter((o) => o.status === column.status).length} {column.status}
            </Badge>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No orders yet today.</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Press{" "}
            <span className="font-medium text-foreground">Simulate dinner rush</span>{" "}
            ↑ — orders, stock, the menu and the radar all move at once.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => {
            const columnOrders = orders.filter((o) => o.status === column.status);
            return (
              <div key={column.status} className="min-w-0">
                <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full ${ORDER_STATUS_DOT[column.status]}`} />
                  {column.label} · {columnOrders.length}
                </p>
                <div className="space-y-2.5">
                  <AnimatePresence initial={false}>
                    {columnOrders.map((order) => (
                      <motion.div
                        key={order.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 320, damping: 28 }}
                      >
                        <Card className="gap-2 py-3">
                          <CardHeader className="px-3.5">
                            <CardTitle className="flex items-center justify-between text-sm">
                              <span>Table {order.tables?.label ?? "—"}</span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {formatTime(order.created_at)}
                              </span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="px-3.5">
                            <ul className="space-y-0.5 text-xs text-muted-foreground">
                              {order.order_items.map((item) => (
                                <li key={item.id}>
                                  {item.dishes?.name} × {item.qty}
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 border-t pt-1.5 text-right font-mono text-sm tabular-nums">
                              {formatINR(orderTotal(order))}
                            </p>
                            <div className="mt-2 flex gap-1.5">
                              {NEXT_STATUS[order.status] && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="flex-1"
                                  onClick={() => bump(order, NEXT_STATUS[order.status]!.to)}
                                >
                                  {NEXT_STATUS[order.status]!.label}
                                </Button>
                              )}
                              {order.status === "served" && (
                                <Button asChild size="sm" className="flex-1">
                                  <Link href={`/dashboard/bill/${order.id}`}>
                                    Generate bill
                                  </Link>
                                </Button>
                              )}
                              {order.status === "paid" && (
                                <Button asChild size="sm" variant="ghost" className="flex-1">
                                  <Link href={`/dashboard/bill/${order.id}`}>
                                    View bill
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
