"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  ChefHat,
  ClipboardList,
  Gauge,
  LayoutGrid,
  MessageSquareHeart,
  Package,
  QrCode,
  ReceiptText,
  Users,
} from "lucide-react";
import { Brand } from "@/components/brand";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operate",
    items: [
      { href: "/dashboard", label: "Overview", icon: Gauge },
      { href: "/dashboard/orders", label: "Orders", icon: ReceiptText },
      { href: "/dashboard/reservations", label: "Reservations", icon: CalendarClock },
      { href: "/dashboard/tables", label: "Tables", icon: LayoutGrid },
    ],
  },
  {
    label: "Stock",
    items: [
      { href: "/dashboard/inventory", label: "Inventory", icon: Package },
      { href: "/dashboard/menu", label: "Menu", icon: ChefHat },
      { href: "/dashboard/prep", label: "Prep sheet", icon: ClipboardList },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquareHeart },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/dashboard/staff", label: "Staff", icon: Users },
      { href: "/dashboard/qr", label: "Table QRs", icon: QrCode },
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
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brass" : "text-muted-foreground/70"}`} />
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
