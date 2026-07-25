"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DEMO_ACCOUNTS, type DemoRole } from "@/lib/demo";

export function DemoEntryButton({
  role,
  label,
  variant = "outline",
}: {
  role: DemoRole;
  label: string;
  variant?: "default" | "outline" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(DEMO_ACCOUNTS[role]);
    if (error) {
      setBusy(false);
      router.push("/login");
      return;
    }
    router.push(role === "owner" ? "/dashboard" : "/kitchen");
    router.refresh();
  }

  return (
    <Button size="lg" variant={variant} disabled={busy} onClick={enter}>
      {busy ? "Entering…" : label}
    </Button>
  );
}
