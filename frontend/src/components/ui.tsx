import { useEffect } from "react";
import { createPortal } from "react-dom";
import { shortDay } from "../lib/format";

const CARD = "glass-card rounded-lg";

const SHAPE = "cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium transition motion-reduce:transition-none active:translate-y-px disabled:cursor-default disabled:opacity-60 max-md:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const BUTTON = {
  primary: `${SHAPE} border border-white/70 bg-linear-to-b from-white/50 to-transparent bg-pink text-ink shadow-soft hover:brightness-105 hover:shadow-float`,
  secondary: `${SHAPE} glass-field border border-white/80 text-ink hover:bg-white/90`,
  danger: `${SHAPE} bg-danger text-white hover:bg-danger/90`,
  ghost: "cursor-pointer rounded-md bg-transparent px-2.5 py-1 text-sm font-semibold text-pink-dark transition motion-reduce:transition-none hover:bg-pink-soft active:translate-y-px disabled:cursor-default disabled:opacity-60 max-md:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
  bare: "cursor-pointer rounded-md text-sm max-md:min-h-11 transition motion-reduce:transition-none disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
};
const FIELD = "w-full border px-4 py-2.5 transition focus:outline-none focus:ring-3 max-md:min-h-11 max-md:text-base";
const FIELD_LIGHT = "glass-field border-white/80 focus:border-pink-dark focus:bg-white focus:ring-pink/40";
const FIELD_DARK = "border-transparent bg-ink text-white placeholder:text-white/55 focus:border-pink focus:ring-pink/50";
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({ variant = "primary", className, ...rest }: React.ComponentProps<"button"> & { variant?: keyof typeof BUTTON }) {
  return <button {...rest} className={cx(BUTTON[variant], className)} />;
}
export const Input = ({ className, dark, ...rest }: React.ComponentProps<"input"> & { dark?: boolean }) => <input {...rest} className={cx(FIELD, "rounded-md", dark ? FIELD_DARK : FIELD_LIGHT, className)} />;
export const Select = ({ className, ...rest }: React.ComponentProps<"select">) => <select {...rest} className={cx(FIELD, "rounded-md", FIELD_LIGHT, className)} />;
export const Textarea = ({ className, ...rest }: React.ComponentProps<"textarea">) => <textarea {...rest} className={cx(FIELD, "rounded-md", FIELD_LIGHT, "min-h-21 resize-y", className)} />;

export const TH = "border-b border-white/60 bg-white/30 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-mute tabular-nums max-md:whitespace-nowrap max-md:px-3 max-md:py-2.5";
export const TD = "border-b border-white/50 px-4 py-3 tabular-nums max-md:whitespace-nowrap max-md:px-3 max-md:py-2.5 max-md:text-sm";
export const TBODY = "[&>tr:last-child>td]:border-b-0 [&>tr:hover>td]:bg-white/50";

export type Tone = "ok" | "warn" | "bad" | "info" | "muted";

const BADGE: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok", warn: "bg-warn-bg text-warn", bad: "bg-bad-bg text-danger", info: "bg-info-bg text-info", muted: "bg-line/40 text-mute",
};
const NOTICE: Record<Tone, string> = {
  ok: "border-ok/25 bg-ok-bg text-ok", warn: "border-warn/25 bg-warn-bg text-warn", bad: "border-danger/25 bg-bad-bg text-danger",
  info: "border-info/25 bg-info-bg text-info", muted: "border-line bg-line/40 text-mute",
};
const VALUE: Record<Tone, string> = { ok: "text-ok", warn: "text-warn", bad: "text-danger", info: "text-info", muted: "text-mute" };
const BAR: Record<Tone, string> = { ok: "bg-ok", warn: "bg-warn", bad: "bg-danger", info: "bg-pink", muted: "bg-pink" };

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-white/50 pb-4 max-md:flex-col [&_h1]:mb-1 [&_h1]:text-[1.6rem] max-md:[&_h1]:text-xl [&_p]:m-0">
      <div>
        <h1 className="mb-4 text-2xl font-semibold tracking-tight max-md:text-xl">{title}</h1>
        {subtitle && <p className="text-mute">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 max-md:w-full max-md:[&>button]:w-full">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: Tone }) {
  return (
    <div className={`${CARD} grid gap-1 px-5 py-4`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-mute">{label}</span>
      <strong className={`text-[1.6rem] font-semibold tracking-tight tabular-nums max-md:text-xl ${tone ? VALUE[tone] : ""}`}>{value}</strong>
      {hint && <span className="text-xs text-mute">{hint}</span>}
    </div>
  );
}

export const Stats = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4 max-md:grid-cols-2 max-md:gap-2.5">{children}</div>;

export function Badge({ tone = "muted", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-semibold ring-1 ring-white/70 before:size-1.5 before:rounded-full before:bg-current before:opacity-80 before:content-[''] ${BADGE[tone]}`}>{children}</span>;
}

export function Notice({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  return <div className={`rounded-lg border px-4 py-3 text-sm backdrop-blur-sm ${NOTICE[tone]}`}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm [&>span]:font-medium [&>span]:text-ink/80">
      <span>{label}</span>
      {children}
      {hint && <small className="text-mute">{hint}</small>}
    </label>
  );
}

export function Modal({
  open, title, onClose, children, footer,
}: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  // Portal to <body>: a backdrop-filter ancestor (.glass) would otherwise become the containing block for `fixed`.
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/30 p-4 backdrop-blur-md" onMouseDown={onClose}>
      <div className="glass glass-float max-h-[92vh] w-full max-w-130 overflow-y-auto rounded-xl p-6 max-md:max-h-[96vh] max-md:p-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        <div className="mb-5 grid gap-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse max-md:[&>button]:w-full">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Success / result popup used where the design has a "…done" screen. */
export function ResultModal({
  open, title, children, onClose, action,
}: { open: boolean; title: string; children: React.ReactNode; onClose: () => void; action?: { label: string; onClick: () => void } }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={<>
        {action && <Button onClick={() => { action.onClick(); onClose(); }}>{action.label}</Button>}
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </>}
    >
      {children}
    </Modal>
  );
}

export function Loading({ loading, error }: { loading: boolean; error: string }) {
  if (error) return <p className="m-0 text-danger">{error}</p>;
  if (loading) return <p className="text-mute">Loading...</p>;
  return null;
}

export function Progress({ value, tone = "info" }: { value: number; tone?: Tone }) {
  return <div className="h-2 overflow-hidden rounded-full bg-white/50 shadow-inner"><div className={`h-full rounded-full ${BAR[tone]}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

export function Steps({ current, steps }: { current: number; steps: string[] }) {
  return (
    <ol className="m-0 flex list-none gap-2 overflow-x-auto p-0 md:flex-wrap">
      {steps.map((s, i) => (
        <li key={s} className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${i + 1 < current ? "bg-ok-bg text-ok" : i + 1 === current ? "bg-pink-soft font-semibold text-pink-dark" : "bg-line/40 text-mute"}`}>
          <span className="grid size-5.5 place-items-center rounded-md bg-white text-xs font-bold">{i + 1}</span> {s}
        </li>
      ))}
    </ol>
  );
}

export function BarChart({ data, label = "Sales this week", tick = shortDay, dense = false }: {
  data: { day: string; total: number }[]; label?: string; tick?: (iso: string) => string;
  /** Many bars (a 30-day view): hide the per-bar values and thin out the axis labels. */
  dense?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className={`flex h-50 items-end pt-5 ${dense ? "gap-0.5" : "gap-2.5 max-md:gap-1"}`} role="img" aria-label={label}>
      {data.map((d, i) => (
        <div key={d.day} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 text-xs" title={`${tick(d.day)}: ${Math.round(d.total).toLocaleString()}`}>
          {!dense && <span className="text-[.7rem] text-mute">{Math.round(d.total).toLocaleString()}</span>}
          <div className={`min-h-0.75 w-full rounded-t-lg transition-colors ${dense ? "" : "max-w-11"} ${i === data.length - 1 ? "bg-pink" : "bg-pink/30 group-hover:bg-pink/50"}`} style={{ height: `${(d.total / max) * 100}%` }} />
          <span className="h-4 whitespace-nowrap text-mute">{dense && i % 5 !== 0 && i !== data.length - 1 ? "" : tick(d.day)}</span>
        </div>
      ))}
    </div>
  );
}

export function PieChart({ data, label = "Chart" }: { data: { label: string; value: number; color: string }[]; label?: string }) {
  const total = data.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 0;
  const gradient = total
    ? data.map((segment) => {
      const start = offset;
      offset += (segment.value / total) * 100;
      return `${segment.color} ${start}% ${offset}%`;
    }).join(", ")
    : "var(--color-line) 0% 100%";

  return (
    <div className="flex flex-wrap items-center gap-5" aria-label={label}>
      <div
        className="size-36 shrink-0 rounded-full"
        role="img"
        aria-label={`${label}: ${data.map((segment) => `${segment.label}, ${segment.value}`).join("; ")}`}
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="m-5 grid size-26 place-items-center rounded-full bg-white/70 text-center shadow-soft backdrop-blur-md">
          <strong className="text-xl tabular-nums">{total}</strong>
          <span className="-mt-5 text-xs text-mute">total</span>
        </div>
      </div>
      <ul className="m-0 grid gap-2 p-0 text-sm">
        {data.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: segment.color }} aria-hidden="true" />
            <span>{segment.label}</span>
            <strong className="tabular-nums">{segment.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface Col<T> { header: string; render: (r: T) => React.ReactNode; align?: "right" }

export function DataTable<T>({ rows, cols, empty = "No records yet." }: { rows: T[]; cols: Col<T>[]; empty?: string }) {
  return (
    <div className={`overflow-x-auto ${CARD}`}>
      <table className="w-full border-collapse">
        <thead><tr>{cols.map((c) => <th key={c.header} className={`${TH} ${c.align ? "text-right" : "text-left"}`}>{c.header}</th>)}</tr></thead>
        <tbody className={TBODY}>
          {rows.length === 0 && <tr><td colSpan={cols.length} className={`${TD} text-left text-mute`}>{empty}</td></tr>}
          {rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.header} className={`${TD} ${c.align ? "text-right" : "text-left"}`}>{c.render(r)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export const statusTone = (s: string): Tone =>
  /low|flag|review|recount|short|near|pending|open|submitted|in transit|in_transit|variance/i.test(s) ? "warn"
    : /resolved|received|confirmed|healthy|matched|reconciled|signed|synced|complete|within/i.test(s) ? "ok"
    : /queued|progress/i.test(s) ? "info" : "muted";
