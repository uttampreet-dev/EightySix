// One color language for entity states, used on every screen.
// Semantic colors stay reserved: green = good/served, amber = attention,
// red = dead/critical, blue = in-flight, brass = brand moments.

export const ORDER_STATUS_BADGE: Record<string, string> = {
  placed: "border-[#3987e5]/40 bg-[#3987e5]/10 text-[#2f6fc4] dark:text-[#6aa5ec]",
  cooking: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  served: "border-green-600/35 dark:border-green-800/60 bg-green-500/10 dark:bg-green-950/30 text-green-600 dark:text-green-500",
  paid: "border-border bg-secondary/50 text-muted-foreground",
};

export const ORDER_STATUS_DOT: Record<string, string> = {
  placed: "bg-[#3987e5]",
  cooking: "bg-amber-400",
  served: "bg-green-500",
  paid: "bg-muted-foreground/50",
};

export const CATEGORY_TINT: Record<string, string> = {
  "Tandoor & Starters": "border-orange-600/30 bg-orange-500/10 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/25 dark:text-orange-300",
  Curries: "border-brass/30 bg-brass/10 text-brass",
  Breads: "border-yellow-600/30 bg-yellow-500/10 text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-950/25 dark:text-yellow-300",
  "Rice & Biryani": "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300",
  "Beverages & Desserts": "border-pink-600/30 bg-pink-500/10 text-pink-700 dark:border-pink-900/50 dark:bg-pink-950/25 dark:text-pink-300",
};

export const RESERVATION_STATUS_BADGE: Record<string, string> = {
  booked: "border-brass/40 bg-brass/10 text-brass",
  seated: "border-green-600/35 dark:border-green-800/60 bg-green-500/10 dark:bg-green-950/30 text-green-600 dark:text-green-500",
  completed: "border-border bg-secondary/50 text-muted-foreground",
  cancelled: "border-border text-muted-foreground line-through",
};
