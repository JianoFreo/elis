import { useEffect } from "react";
import { shortDay } from "../lib/format";

const CARD = "rounded-md border border-line bg-white ";

export type Tone = "ok" | "warn" | "bad" | "info" | "muted";

const BADGE: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok", warn: "bg-warn-bg text-warn", bad: "bg-bad-bg text-danger", info: "bg-info-bg text-info", muted: "bg-sunken text-mute",
};
const NOTICE: Record<Tone, string> = {
  ok: "border-ok-line bg-ok-bg text-ok", warn: "border-warn-line bg-warn-bg text-warn", bad: "border-bad-line bg-bad-bg text-danger",
  info: "border-info-line bg-info-bg text-info", muted: "border-line bg-sunken text-mute",
};
const VALUE: Record<Tone, string> = { ok: "text-ok", warn: "text-warn", bad: "text-danger", info: "text-info", muted: "text-mute" };
const BAR: Record<Tone, string> = { ok: "bg-ok", warn: "bg-warn", bad: "bg-danger", info: "bg-pink", muted: "bg-pink" };

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4 max-md:flex-col [&_h1]:mb-1 [&_h1]:text-[1.6rem] max-md:[&_h1]:text-xl [&_p]:m-0">
      <div>
        <h1>{title}</h1>
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
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 py-0.5 text-xs font-semibold before:size-1.5 before:rounded-sm before:bg-current before:opacity-80 before:content-[''] ${BADGE[tone]}`}>{children}</span>;
}

export function Notice({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  return <div className={`rounded-md border px-4 py-3 text-sm ${NOTICE[tone]}`}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm [&>span]:font-medium [&>span]:text-body">
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
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/50 p-4" onMouseDown={onClose}>
      <div className={`${CARD} max-h-[92vh] w-full max-w-130 overflow-y-auto rounded-md p-6 shadow-lg max-md:max-h-[96vh] max-md:p-4`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="mb-5 grid gap-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse max-md:[&>button]:w-full">{footer}</div>}
      </div>
    </div>
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
        {action && <button onClick={() => { action.onClick(); onClose(); }}>{action.label}</button>}
        <button className="border border-line bg-white text-ink shadow-none hover:bg-surface-alt" onClick={onClose}>Close</button>
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
  return <div className="h-2 overflow-hidden rounded-sm bg-sunken"><div className={`h-full ${BAR[tone]}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

export function Steps({ current, steps }: { current: number; steps: string[] }) {
  return (
    <ol className="m-0 flex list-none gap-2 overflow-x-auto p-0 md:flex-wrap">
      {steps.map((s, i) => (
        <li key={s} className={`flex items-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm ${i + 1 < current ? "bg-ok-bg text-ok" : i + 1 === current ? "bg-pink-soft font-semibold text-pink-dark" : "bg-sunken text-mute"}`}>
          <span className="grid size-5.5 place-items-center rounded-sm bg-white text-xs font-bold">{i + 1}</span> {s}
        </li>
      ))}
    </ol>
  );
}

export function BarChart({ data, label = "Sales this week" }: { data: { day: string; total: number }[]; label?: string }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="flex h-50 items-end gap-2.5 pt-5 max-md:gap-1" role="img" aria-label={label}>
      {data.map((d, i) => (
        <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1 text-xs">
          <span className="text-[.7rem] text-mute">{Math.round(d.total).toLocaleString()}</span>
          <div className={`min-h-0.75 w-full max-w-11 rounded-t-sm transition-colors ${i === data.length - 1 ? "bg-pink" : "bg-pink/30 group-hover:bg-pink/50"}`} style={{ height: `${(d.total / max) * 100}%` }} />
          <span className="text-mute">{shortDay(d.day)}</span>
        </div>
      ))}
    </div>
  );
}

export interface Col<T> { header: string; render: (r: T) => React.ReactNode; align?: "right" }

export function DataTable<T>({ rows, cols, empty = "No records yet." }: { rows: T[]; cols: Col<T>[]; empty?: string }) {
  return (
    <div className={`overflow-x-auto ${CARD}`}>
      <table>
        <thead><tr>{cols.map((c) => <th key={c.header} className={c.align && "text-right"}>{c.header}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={cols.length} className="text-mute">{empty}</td></tr>}
          {rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.header} className={c.align && "text-right"}>{c.render(r)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export const statusTone = (s: string): Tone =>
  /low|flag|review|recount|short|near|pending|open|submitted|in transit|in_transit|variance/i.test(s) ? "warn"
    : /resolved|received|confirmed|healthy|matched|reconciled|signed|synced|complete|within/i.test(s) ? "ok"
    : /queued|progress/i.test(s) ? "info" : "muted";
