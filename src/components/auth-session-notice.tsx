"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// Auth pages stay reachable while signed in (so sign-in can always be
// demonstrated end-to-end); this strip explains the current session and
// offers the two honest ways out.
export function AuthSessionNotice() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (!cancelled && user?.email) setEmail(user.email);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!email) return null;

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    setEmail(null);
    setSigningOut(false);
    router.refresh();
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-brass/30 bg-brass/8 px-3.5 py-2.5">
      <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{email}</span>
      </p>
      <Button asChild size="sm" variant="secondary">
        <Link href="/dashboard">Continue</Link>
      </Button>
      <Button size="sm" variant="outline" disabled={signingOut} onClick={signOut}>
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
