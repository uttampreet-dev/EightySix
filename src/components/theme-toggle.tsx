"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";

const ORDER = ["dark", "light", "system"] as const;

const LABEL: Record<(typeof ORDER)[number], string> = {
  dark: "Dark",
  light: "Light",
  system: "Auto",
};

// One button, three states — dark → light → auto, like every delivery app.
export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, setTheme } = useTheme();
  // theme is unknowable server-side; render a stable placeholder until hydrated
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const current = mounted
    ? (ORDER.includes(theme as (typeof ORDER)[number])
        ? (theme as (typeof ORDER)[number])
        : "system")
    : "dark";
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : SunMoon;

  return (
    <Button
      variant="ghost"
      size={showLabel ? "sm" : "icon"}
      className={showLabel ? "justify-start gap-2.5 px-2 text-muted-foreground" : "h-8 w-8"}
      aria-label={`Theme: ${LABEL[current]} — switch`}
      title={`Theme: ${LABEL[current]}`}
      onClick={() => setTheme(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])}
    >
      <Icon className="h-4 w-4" />
      {showLabel && <span className="text-sm font-normal">Theme: {LABEL[current]}</span>}
    </Button>
  );
}
