/** Only pending sales and a branch workspace snapshot live here; auth tokens remain in sessionStorage. */
export interface SalesContext {
  userId: string;
  branchId: number;
}
export interface LocalSale {
  local_ref: string;
  product_code: string;
  product: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sold_at: string;
  error?: string;
}
const PREFIX = "eyk:sales:v1";
export const salesKey = (c: SalesContext) =>
  `${PREFIX}:${encodeURIComponent(c.userId)}:${c.branchId}`;
export function newReference() {
  if (typeof crypto.randomUUID === "function")
    return `L-${crypto.randomUUID()}`;
  return `L-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, "0")).join("")}`;
}
export function captureTime(date: string) {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  return `${date}T${time}+08:00`;
}
export function readLocalSales(
  c: SalesContext,
  storage: Storage = window.localStorage,
): LocalSale[] {
  const raw = storage.getItem(salesKey(c));
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "The saved sales queue could not be read. Keep this browser's data and ask for support; it has not been erased.",
    );
  }
  if (
    !Array.isArray(parsed) ||
    parsed.some(
      (x) =>
        !x ||
        typeof x.local_ref !== "string" ||
        !Number.isInteger(x.quantity) ||
        x.quantity <= 0 ||
        typeof x.product_code !== "string" ||
        !Number.isFinite(x.unit_price) ||
        typeof x.sold_at !== "string",
    )
  )
    throw new Error(
      "The saved sales queue is invalid. It has not been erased.",
    );
  return parsed;
}
function notify() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("eyk:sales-outbox"));
}
async function mutate(
  c: SalesContext,
  fn: (rows: LocalSale[]) => LocalSale[],
  storage: Storage,
) {
  const work = () => {
    const next = fn(readLocalSales(c, storage));
    try {
      storage.setItem(salesKey(c), JSON.stringify(next));
    } catch {
      throw new Error(
        "The sale could not be saved on this device. Free browser storage or enable site storage and try again. It is not queued yet.",
      );
    }
    notify();
  };
  if (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    navigator.locks
  )
    await navigator.locks.request(salesKey(c), work);
  else work();
}
export async function enqueueSale(
  c: SalesContext,
  sale: LocalSale,
  storage: Storage = window.localStorage,
) {
  if (
    !Number.isSafeInteger(sale.quantity) ||
    sale.quantity < 1 ||
    !Number.isFinite(sale.unit_price) ||
    sale.unit_price < 0 ||
    !sale.local_ref ||
    sale.local_ref.length > 40 ||
    !Number.isFinite(Date.parse(sale.sold_at))
  )
    throw new Error("Enter a valid sale before queuing it.");
  await mutate(
    c,
    (rows) => {
      const old = rows.find((r) => r.local_ref === sale.local_ref);
      if (old) {
        if (
          JSON.stringify({ ...old, error: undefined }) !==
          JSON.stringify({ ...sale, error: undefined })
        )
          throw new Error("A different sale already uses this reference.");
        return rows;
      }
      return [...rows, sale];
    },
    storage,
  );
}
export async function removeLocalSale(
  c: SalesContext,
  ref: string,
  storage: Storage = window.localStorage,
) {
  await mutate(c, (rows) => rows.filter((r) => r.local_ref !== ref), storage);
}
export async function failLocalSale(
  c: SalesContext,
  ref: string,
  error: string,
  storage: Storage = window.localStorage,
) {
  await mutate(
    c,
    (rows) => rows.map((r) => (r.local_ref === ref ? { ...r, error } : r)),
    storage,
  );
}
export const reservedQuantity = (rows: LocalSale[], code: string) =>
  rows
    .filter((r) => r.product_code === code)
    .reduce((n, r) => n + r.quantity, 0);
export const salePayload = (s: LocalSale) => ({
  product_code: s.product_code,
  quantity: s.quantity,
  local_ref: s.local_ref,
  sold_at: s.sold_at,
  offline: false,
});
