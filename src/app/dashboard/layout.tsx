import { getOwnerContext } from "@/lib/owner";
import { DashboardMobileNav, DashboardSidebar } from "@/components/dashboard/sidebar";
import { RushControls } from "@/components/dashboard/rush-controls";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { restaurant, user } = await getOwnerContext();

  return (
    <div className="flex flex-1">
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Toaster position="top-center" richColors />
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur print:hidden">
          <div className="flex items-center justify-between gap-3 px-6 py-3">
            <div className="min-w-0">
              <p className="truncate font-serif text-lg font-medium leading-tight">
                {restaurant.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user.email}
              </p>
            </div>
            <RushControls restaurantId={restaurant.id} />
          </div>
          <DashboardMobileNav />
        </header>
        <main className="min-w-0 flex-1 px-6 pb-16">{children}</main>
      </div>
    </div>
  );
}
