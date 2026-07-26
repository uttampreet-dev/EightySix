import { getOwnerContext } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { StaffClient } from "./staff-client";

export const dynamic = "force-dynamic";

export type StaffMember = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  lastSignIn: string | null;
};

export default async function StaffPage() {
  const { restaurant } = await getOwnerContext("/dashboard/staff");

  const admin = createAdminClient();
  const [{ data: profiles }, usersResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id, role, created_at")
      .eq("restaurant_id", restaurant.id),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);

  const emailById = new Map(
    usersResult.data.users.map((u) => [
      u.id,
      { email: u.email ?? "—", lastSignIn: u.last_sign_in_at ?? null },
    ])
  );
  const staff: StaffMember[] = (profiles ?? [])
    .map((p) => ({
      id: p.id,
      role: p.role,
      created_at: p.created_at,
      email: emailById.get(p.id)?.email ?? "—",
      lastSignIn: emailById.get(p.id)?.lastSignIn ?? null,
    }))
    .sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email));

  return <StaffClient staff={staff} />;
}
