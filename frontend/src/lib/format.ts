export const peso = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === "" ? "-" : `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const num = (n: number | string | null | undefined, digits = 2) =>
  n === null || n === undefined || n === "" ? "-" : Number(n).toLocaleString("en-PH", { maximumFractionDigits: digits });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-08" or an ISO timestamp -> "08 Nov 2026" (Philippine time for timestamps). */
export function fmtDate(v: string | null | undefined): string {
  if (!v) return "-";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+08:00`) : new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", day: "2-digit", month: "numeric", year: "numeric" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("day")} ${MONTHS[Number(get("month")) - 1]} ${get("year")}`;
}

export function fmtTime(v: string | null | undefined): string {
  if (!v) return "-";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v));
}

export const fmtDateTime = (v: string | null | undefined) => (v ? `${fmtDate(v)}, ${fmtTime(v)}` : "-");

export const shortDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", weekday: "short" }).format(new Date(`${iso}T00:00:00+08:00`));

export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export const DISPATCH_STATUS: Record<string, string> = { in_transit: "In transit", received: "Received", receipt_review: "Receipt review" };
export const MOVEMENT_LABEL: Record<string, string> = {
  opening_baseline: "Opening baseline", production_output: "Production output", dispatch_out: "Dispatch to branches",
  receipt_in: "Branch receipt", sale: "Sale", adjustment: "Approved adjustment",
};
