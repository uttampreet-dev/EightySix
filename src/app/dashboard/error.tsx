"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto mt-16 w-full max-w-md rounded-xl border border-border/60 bg-card p-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-red-600 dark:text-red-400">
        Something broke
      </p>
      <h2 className="mt-2 font-serif text-2xl font-medium tracking-tight">
        The console hit an error
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
