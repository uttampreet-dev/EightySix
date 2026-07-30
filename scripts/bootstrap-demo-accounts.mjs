// Creates (or repairs) the one-click demo accounts against the Supabase
// project in .env.local. Idempotent — safe to re-run any time.
// Run AFTER the migrations: node scripts/bootstrap-demo-accounts.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACCOUNTS = [
  { email: "owner@eightysix.demo", password: "eightysix-owner-demo", role: "owner" },
  { email: "kitchen@eightysix.demo", password: "eightysix-kitchen-demo", role: "kitchen" },
  { email: "waiter@eightysix.demo", password: "eightysix-waiter-demo", role: "waiter" },
];

const { data: restaurant, error: rErr } = await supabase
  .from("restaurants")
  .select("id")
  .eq("slug", "demo")
  .single();
if (rErr) throw new Error(`demo restaurant missing — run migrations first (${rErr.message})`);

for (const account of ACCOUNTS) {
  let userId;
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { role: account.role },
  });
  if (error) {
    if (!/already/i.test(error.message)) throw error;
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    userId = list.users.find((u) => u.email === account.email)?.id;
    if (!userId) throw new Error(`${account.email}: exists but not found`);
    console.log(`= ${account.email} already exists`);
  } else {
    userId = created.user.id;
    console.log(`+ created ${account.email}`);
  }

  // ensure the profile row carries the right role (the signup trigger may
  // have defaulted an account created before the waiter role existed)
  const { error: pErr } = await supabase
    .from("profiles")
    .upsert({ id: userId, restaurant_id: restaurant.id, role: account.role });
  if (pErr) throw pErr;
  console.log(`  ✓ profile: ${account.role} @ demo restaurant`);
}

console.log("done — all demo accounts ready");
