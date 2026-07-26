// One color language for entity states, used on every screen.
// Semantic colors stay reserved: green = good/served, amber = attention,
// red = dead/critical, blue = in-flight, brass = brand moments.

export const ORDER_STATUS_BADGE: Record<string, string> = {
  placed: "border-[#3987e5]/40 bg-[#3987e5]/10 text-[#6aa5ec]",
  cooking: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  served: "border-green-800/60 bg-green-950/30 text-green-500",
  paid: "border-border bg-secondary/50 text-muted-foreground",
};

export const ORDER_STATUS_DOT: Record<string, string> = {
  placed: "bg-[#3987e5]",
  cooking: "bg-amber-400",
  served: "bg-green-500",
  paid: "bg-muted-foreground/50",
};

export const CATEGORY_TINT: Record<string, string> = {
  "Tandoor & Starters": "border-orange-900/50 bg-orange-950/25 text-orange-300",
  Curries: "border-brass/30 bg-brass/10 text-brass",
  Breads: "border-yellow-900/50 bg-yellow-950/25 text-yellow-300",
  "Rice & Biryani": "border-emerald-900/50 bg-emerald-950/25 text-emerald-300",
  "Beverages & Desserts": "border-pink-900/50 bg-pink-950/25 text-pink-300",
};

export const RESERVATION_STATUS_BADGE: Record<string, string> = {
  booked: "border-brass/40 bg-brass/10 text-brass",
  seated: "border-green-800/60 bg-green-950/30 text-green-500",
  completed: "border-border bg-secondary/50 text-muted-foreground",
  cancelled: "border-border text-muted-foreground line-through",
};
