"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import {
  getReservations,
  type Reservation,
  type Restaurant,
  type RestaurantTable,
} from "@/lib/engine";
import { updateReservation } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { RESERVATION_STATUS_BADGE as STATUS_TONE } from "@/lib/status-colors";

export function ReservationsClient({
  restaurant,
  initialReservations,
  tables,
}: {
  restaurant: Restaurant;
  initialReservations: Reservation[];
  tables: RestaurantTable[];
}) {
  const [reservations, setReservations] = useState(initialReservations);

  const refetch = useCallback(async () => {
    setReservations(await getReservations(createClient(), restaurant.id));
  }, [restaurant.id]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`reservations-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `restaurant_id=eq.${restaurant.id}` },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            toast.info("Reservations updated");
            refetch();
          }, 300);
        }
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, refetch]);

  async function update(
    reservation: Reservation,
    updates: Parameters<typeof updateReservation>[1]
  ) {
    const result = await updateReservation(reservation.id, updates);
    if (!result.ok) toast.error(result.error);
    refetch();
  }

  const upcoming = reservations.filter(
    (r) => r.status === "booked" || r.status === "seated"
  );
  const past = reservations.filter(
    (r) => r.status === "completed" || r.status === "cancelled"
  );

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mt-6">
        <h1 className="font-serif text-2xl font-medium tracking-tight">Reservations</h1>
        <p className="text-xs text-muted-foreground">
          Diners book from the menu page — bookings land here live.
        </p>
      </div>

      {upcoming.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No upcoming reservations.</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Open the diner menu and tap{" "}
            <span className="font-medium text-foreground">Reserve a table</span> —
            it appears here the same second.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          <AnimatePresence initial={false}>
            {upcoming.map((reservation) => (
              <motion.div
                key={reservation.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {reservation.name}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {reservation.phone}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(reservation.reserved_at).toLocaleString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · party of {reservation.party_size}
                    {reservation.note && ` · "${reservation.note}"`}
                  </p>
                </div>
                <Badge variant="outline" className={`font-mono ${STATUS_TONE[reservation.status]}`}>
                  {reservation.status}
                </Badge>
                <Select
                  value={reservation.table_id ?? undefined}
                  onValueChange={(v) => update(reservation, { tableId: v })}
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue placeholder="Assign table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        Table {t.label} · {t.seats}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reservation.status === "booked" ? (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!reservation.table_id}
                      onClick={() =>
                        update(reservation, { status: "seated", tableId: reservation.table_id })
                      }
                    >
                      Seat
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400"
                      onClick={() =>
                        update(reservation, { status: "cancelled", tableId: reservation.table_id })
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      update(reservation, { status: "completed", tableId: reservation.table_id })
                    }
                  >
                    Complete
                  </Button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mb-2 mt-10 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            History
          </h2>
          <div className="space-y-1">
            {past.slice(0, 10).map((reservation) => (
              <div
                key={reservation.id}
                className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground"
              >
                <span className="flex-1 truncate">
                  {reservation.name} · party of {reservation.party_size} ·{" "}
                  {new Date(reservation.reserved_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <Badge variant="outline" className={`font-mono ${STATUS_TONE[reservation.status]}`}>
                  {reservation.status}
                </Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
