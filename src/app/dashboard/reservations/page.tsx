import { getOwnerContext } from "@/lib/owner";
import { getReservations, getTables } from "@/lib/engine";
import { ReservationsClient } from "./reservations-client";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const { supabase, restaurant } = await getOwnerContext("/dashboard/reservations");
  const [reservations, tables] = await Promise.all([
    getReservations(supabase, restaurant.id),
    getTables(supabase, restaurant.id),
  ]);
  return (
    <ReservationsClient
      restaurant={restaurant}
      initialReservations={reservations}
      tables={tables}
    />
  );
}
