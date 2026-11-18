// Pure seed data (no database access) so it can be checked on its own.
// Figures come from the Figma prototype: week 02-08 Nov 2026 totals 90,145 with
// Main Street 34,345 / Market Road 31,100 / Town Center 24,700.

export const PRICES = { "Chicken empanada": 65, "Cheese roll": 45, "Banana loaf": 120 } as const;
export type ProductName = keyof typeof PRICES;
export const PRODUCT_NAMES = Object.keys(PRICES) as ProductName[];

export const BRANCHES = ["Main Street", "Market Road", "Town Center"] as const;
export type BranchName = (typeof BRANCHES)[number];

// Mon 02 Nov ... Sun 08 Nov 2026
export const DAYS = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];

// PHP sales per branch per day. Rows sum to the daily totals on the overview chart
// (9,200 / 11,400 / 10,100 / 13,200 / 16,900 / 14,800 / 14,545).
export const DAILY_SALES: Record<BranchName, number[]> = {
  "Main Street": [2400, 4300, 3000, 5100, 8400, 6500, 4645],
  "Market Road": [3800, 4400, 3900, 4300, 4900, 4600, 5200],
  "Town Center": [3000, 2700, 3200, 3800, 3600, 3700, 4700],
};

/** Split a peso total into whole units of the three products (65a + 45b + 120c = total). */
export function splitTotal(total: number): Record<ProductName, number> {
  let best: [number, number, number] | null = null;
  let bestScore = Infinity;
  for (let c = 1; c * 120 < total; c++) {
    for (let b = 1; c * 120 + b * 45 < total; b++) {
      const rest = total - c * 120 - b * 45;
      if (rest <= 0 || rest % 65 !== 0) continue;
      const a = rest / 65;
      const score = (a - b) ** 2 + (2 * c - b) ** 2; // keep the mix realistic, banana loaf sells least
      if (score < bestScore) {
        bestScore = score;
        best = [a, b, c];
      }
    }
  }
  if (!best) throw new Error(`Cannot split ${total} into product sales`);
  return { "Chicken empanada": best[0], "Cheese roll": best[1], "Banana loaf": best[2] };
}

// Main Street, 08 Nov: individual transactions (68 items sold). Last empanada sale is the 3-unit one at 11:45.
export const MAIN_STREET_NOV8: { product: ProductName; qty: number; time: string }[] = [
  { product: "Chicken empanada", qty: 8, time: "10:35" },
  { product: "Chicken empanada", qty: 5, time: "10:50" },
  { product: "Chicken empanada", qty: 4, time: "11:10" },
  { product: "Chicken empanada", qty: 3, time: "11:25" },
  { product: "Cheese roll", qty: 10, time: "09:20" },
  { product: "Cheese roll", qty: 8, time: "10:05" },
  { product: "Cheese roll", qty: 7, time: "10:55" },
  { product: "Cheese roll", qty: 5, time: "11:30" },
  { product: "Banana loaf", qty: 6, time: "09:35" },
  { product: "Banana loaf", qty: 5, time: "10:25" },
  { product: "Banana loaf", qty: 4, time: "11:00" },
  { product: "Chicken empanada", qty: 3, time: "11:45" },
];

export const DEMO_USERS = [
  { username: "juan.delacruz", full_name: "Juan Dela Cruz", role: "owner", branch: null },
  { username: "ana.reyes", full_name: "Ana Reyes", role: "sales-staff", branch: "Main Street" },
  { username: "marco.santos", full_name: "Marco Santos", role: "production-head", branch: "Main hub" },
  { username: "rica.cruz", full_name: "Rica Cruz", role: "production-staff", branch: "Main hub" },
  // not in the prototype's account list: someone has to own the other two branches' sales
  { username: "paolo.garcia", full_name: "Paolo Garcia", role: "sales-staff", branch: "Market Road" },
  { username: "liza.mendoza", full_name: "Liza Mendoza", role: "sales-staff", branch: "Town Center" },
] as const;

export const BRANCH_STAFF: Record<BranchName, string> = {
  "Main Street": "ana.reyes",
  "Market Road": "paolo.garcia",
  "Town Center": "liza.mendoza",
};
