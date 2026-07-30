// Demo accounts for one-click evaluator entry. These are intentionally
// public — the demo restaurant is a sandbox and reset_demo() restores it.
export const DEMO_ACCOUNTS = {
  owner: { email: "owner@eightysix.demo", password: "eightysix-owner-demo" },
  kitchen: { email: "kitchen@eightysix.demo", password: "eightysix-kitchen-demo" },
  waiter: { email: "waiter@eightysix.demo", password: "eightysix-waiter-demo" },
} as const;

export const DEMO_HOME: Record<DemoRole, string> = {
  owner: "/dashboard",
  kitchen: "/kitchen",
  waiter: "/waiter",
};

export type DemoRole = keyof typeof DEMO_ACCOUNTS;
