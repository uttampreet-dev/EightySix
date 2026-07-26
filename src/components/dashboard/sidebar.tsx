"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";

const SECTIONS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "Operate",
    items: [
      { href: "/dashboard", label: "Overview" },
      { href: "/dashboard/orders", label: "Orders" },
      { href: "/dashboard/reservations", label: "Reservations" },
      { href: "/dashboard/tables", label: "Tables" },
    ],
  },
  {
    label: "Stock",
    items: [
      { href: "/dashboard/inventory", label: "Inventory" },
      { href: "/dashboard/menu", label: "Menu" },
      { href: "/dashboard/prep", label: "Prep sheet" },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/dashboard/analytics", label: "Analytics" },
      { href: "/dashboard/feedback", label: "Feedback" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/dashboard/staff", label: "Staff" },
      { href: "/dashboard/qr", label: "Table QRs" },
    ],
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-border/60 bg-white/1.5 px-4 py-5 lg:flex print:hidden">
      <Brand className="text-lg" />
      <nav className="mt-7 flex flex-1 flex-col gap-6 overflow-y-auto">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-2 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground/70">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-2 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-0.5 border-t border-border/60 pt-3">
        <Link
          href="/r/demo"
          className="rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Diner menu ↗
        </Link>
        <Link
          href="/kitchen"
          className="rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Kitchen ↗
        </Link>
      </div>
    </aside>
  );
}

export function DashboardMobileNav() {
  const pathname = usePathname();
  const items = SECTIONS.flatMap((s) => s.items);
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border/60 px-4 py-2 lg:hidden print:hidden">
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${
              active
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
