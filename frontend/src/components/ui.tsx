import { useEffect } from "react";
import { shortDay } from "../lib/format";

export type Tone = "ok" | "warn" | "bad" | "info" | "muted";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: Tone }) {
  return (
    <div className={`card stat ${tone ? `tone-${tone}` : ""}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="muted stat-hint">{hint}</span>}
    </div>
  );
}

export const Stats = ({ children }: { children: React.ReactNode }) => <div className="stats">{children}</div>;

export function Badge({ tone = "muted", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Notice({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
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
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
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
        <button className="secondary" onClick={onClose}>Close</button>
      </>}
    >
      {children}
    </Modal>
  );
}

export function Loading({ loading, error }: { loading: boolean; error: string }) {
  if (error) return <p className="error">{error}</p>;
  if (loading) return <p className="muted">Loading...</p>;
  return null;
}

export function Progress({ value, tone = "info" }: { value: number; tone?: Tone }) {
  return <div className="progress"><div className={`progress-bar tone-${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

export function Steps({ current, steps }: { current: number; steps: string[] }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={s} className={i + 1 < current ? "done" : i + 1 === current ? "now" : ""}>
          <span>{i + 1}</span> {s}
        </li>
      ))}
    </ol>
  );
}

export function BarChart({ data }: { data: { day: string; total: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="bars" role="img" aria-label="Sales this week">
      {data.map((d, i) => (
        <div key={d.day} className="bar-col">
          <span className="bar-val">{Math.round(d.total).toLocaleString()}</span>
          <div className={`bar ${i === data.length - 1 ? "today" : ""}`} style={{ height: `${(d.total / max) * 100}%` }} />
          <span className="muted">{shortDay(d.day)}</span>
        </div>
      ))}
    </div>
  );
}

export interface Col<T> { header: string; render: (r: T) => React.ReactNode; align?: "right" }

export function DataTable<T>({ rows, cols, empty = "No records yet." }: { rows: T[]; cols: Col<T>[]; empty?: string }) {
  return (
    <div className="table-wrap card">
      <table>
        <thead><tr>{cols.map((c) => <th key={c.header} className={c.align}>{c.header}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={cols.length} className="muted">{empty}</td></tr>}
          {rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.header} className={c.align}>{c.render(r)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export const statusTone = (s: string): Tone =>
  /low|flag|review|recount|short|near|pending|open|submitted|in transit|in_transit|variance/i.test(s) ? "warn"
    : /resolved|received|confirmed|healthy|matched|reconciled|signed|synced|complete|within/i.test(s) ? "ok"
    : /queued|progress/i.test(s) ? "info" : "muted";
