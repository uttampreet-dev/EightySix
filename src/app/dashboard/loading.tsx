// Instant feedback while a console page (and any AI narrative it awaits)
// server-renders — otherwise navigation feels dead for seconds.
export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mt-6 h-16 animate-pulse rounded-xl border border-border/60 bg-black/2 dark:bg-white/1.5" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-border/60 bg-black/2 dark:bg-white/1.5"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="h-72 animate-pulse rounded-xl border border-border/60 bg-black/2 dark:bg-white/1.5" />
        <div className="h-72 animate-pulse rounded-xl border border-border/60 bg-black/2 dark:bg-white/1.5" />
      </div>
    </div>
  );
}
