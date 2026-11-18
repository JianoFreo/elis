import { useState } from "react";
import { api } from "../../../lib/axios";
import { Badge, DataTable, Field, Loading, Modal, Notice, PageHeader, Progress, ResultModal, StatCard, Stats, statusTone } from "../../../components/ui";
import { useGo } from "../../../lib/nav";
import { errMsg, useApi } from "../../../lib/useApi";
import { fmtDate, peso } from "../../../lib/format";

interface AuditRow {
  audit_code: string; week_start: string; week_end: string; status: string; sales: number; confirmed: number; total_closings: number; open_flags: number; branches: number;
}
interface Detail {
  audit: { audit_code: string; week_start: string; week_end: string; status: string; total_sales: number; signed_by: string | null; signed_at: string | null; note: string | null };
  branches: { branch_id: number; branch: string; confirmed_days: number; days: number; sales: number; stock_status: string; flags: number }[];
  summary: { sales: number; confirmed: number; total: number; open_flags: number; ready: boolean };
  pending_closings: { close_code: string; date: string; status: string; branch: string; open_flags: number }[];
}
interface Baseline { branch: string; products: { product_code: string; product: string; qty: number }[] }

const week = (a: { week_start: string; week_end: string }) => `${fmtDate(a.week_start)} – ${fmtDate(a.week_end)}`;

export default function Audits() {
  const { id } = useGo();
  return id ? <AuditDetail code={id} /> : <AuditList />;
}

function AuditList() {
  const { data, error, loading } = useApi<{ audits: AuditRow[] }>("/api/owner/audits");
  const { go } = useGo();
  if (!data) return <Loading loading={loading} error={error} />;
  const current = data.audits.find((a) => a.status !== "signed_off") ?? data.audits[0];
  return (
    <div className="grid gap-5">
      <PageHeader title="A week, brought together." subtitle="Compile confirmed daily summaries, resolve exceptions and sign off." actions={current && <button onClick={() => go("audits", current.audit_code)}>Review current weekly audit</button>} />
      {current && (
        <Stats>
          <StatCard label="Weekly sales" value={peso(current.sales)} hint="All branches" />
          <StatCard label="Confirmed daily closings" value={`${current.confirmed} / ${current.total_closings}`} hint={`${current.total_closings - current.confirmed} pending review`} />
          <StatCard label="Open flags" value={current.open_flags} tone={current.open_flags ? "warn" : "ok"} hint="Resolve before sign-off" />
        </Stats>
      )}
      <DataTable
        rows={data.audits}
        cols={[
          { header: "Week", render: (a) => week(a) },
          { header: "Audit", render: (a) => a.audit_code },
          { header: "Branches", render: (a) => a.branches, align: "right" },
          { header: "Sales", render: (a) => peso(a.sales), align: "right" },
          { header: "Flags", render: (a) => `${a.open_flags} open`, align: "right" },
          { header: "Audit status", render: (a) => <Badge tone={a.status === "signed_off" ? "ok" : "warn"}>{a.status === "signed_off" ? "Signed off" : "In review"}</Badge> },
          { header: "", render: (a) => <button className="bg-transparent px-1.5 py-1 font-semibold text-pink-dark shadow-none hover:bg-pink-soft" onClick={() => go("audits", a.audit_code)}>Open</button> },
        ]}
      />
    </div>
  );
}

function AuditDetail({ code }: { code: string }) {
  const { data, error, loading, reload } = useApi<Detail>(`/api/owner/audits/${code}`);
  const { go } = useGo();
  const [note, setNote] = useState("Reviewed daily summaries, deliveries and approved adjustments.");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [signedMsg, setSignedMsg] = useState<{ sales: number; closings: number } | null>(null);
  const [baseOpen, setBaseOpen] = useState(false);
  const [branchId, setBranchId] = useState("");
  const base = useApi<Baseline>(baseOpen && branchId ? `/api/owner/audits/${code}/baseline` : null, { branch_id: branchId });
  const [baseDone, setBaseDone] = useState("");
  if (!data) return <Loading loading={loading} error={error} />;
  const { audit, summary } = data;
  const signedOff = audit.status === "signed_off";
  const pct = summary.total ? Math.round((summary.confirmed / summary.total) * 100) : 0;

  async function confirmClosing(closeCode: string) {
    setMsg("");
    try { await api.post(`/api/owner/closings/${closeCode}/confirm`); reload(); } catch (e) { setMsg(errMsg(e)); }
  }
  async function signOff() {
    setBusy(true); setMsg("");
    try { const r = await api.post(`/api/owner/audits/${code}/signoff`, { note }); setSignedMsg(r.data); reload(); }
    catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  }
  async function confirmBaseline() {
    setBusy(true); setMsg("");
    try { const r = await api.post(`/api/owner/audits/${code}/baseline`, { branch_id: Number(branchId) }); setBaseDone(`Next opening confirmed (${r.data.reference}). Opening values carry forward the verified closing; no stock is added twice.`); setBaseOpen(false); }
    catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title={`Weekly audit · ${week(audit)}`}
        subtitle="Confirmed daily records and stock statuses for all branches."
        actions={<>
          {signedOff
            ? <button onClick={() => { setBranchId(String(data.branches[0]?.branch_id ?? "")); setMsg(""); setBaseOpen(true); }}>Set next opening baseline</button>
            : <button disabled={!summary.ready || busy} onClick={signOff}>{busy ? "Signing..." : "Sign off week"}</button>}
          <button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => go("audits")}>All audits</button>
        </>}
      />
      <div className="rounded-xl border border-line bg-white shadow-sm p-5 max-md:p-4 grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4"><strong>{signedOff ? "Week signed off" : summary.ready ? "Ready for weekly sign-off" : "Weekly review readiness"}</strong><span>{summary.confirmed} / {summary.total}</span></div>
        <Progress value={pct} tone={summary.ready ? "ok" : "info"} />
        {signedOff
          ? <Notice tone="ok">Closed by {audit.signed_by ?? "-"} · {fmtDate(audit.signed_at)}. Confirmed sales {peso(audit.total_sales)}. {audit.note}</Notice>
          : summary.ready
            ? <Notice tone="ok">All daily closings are confirmed and open flags are resolved.</Notice>
            : <Notice tone="warn">{summary.total - summary.confirmed} closing(s) pending and {summary.open_flags} open flag(s). Resolve them before sign-off.</Notice>}
        {!signedOff && summary.ready && (
          <Field label="Owner sign-off note"><textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        )}
      </div>
      {msg && <p className="m-0 text-danger">{msg}</p>}

      <DataTable
        rows={data.branches}
        cols={[
          { header: "Branch", render: (b) => b.branch },
          { header: "Confirmed days", render: (b) => `${b.confirmed_days}/${b.days}`, align: "right" },
          { header: "Sales", render: (b) => peso(b.sales), align: "right" },
          { header: "Stock status", render: (b) => <Badge tone={statusTone(b.stock_status)}>{b.stock_status}</Badge> },
          { header: "Flags", render: (b) => b.flags, align: "right" },
        ]}
      />

      {data.pending_closings.length > 0 && (
        <div>
          <h2>Closings awaiting review</h2>
          <DataTable
            rows={data.pending_closings}
            cols={[
              { header: "Closing", render: (c) => c.close_code },
              { header: "Date", render: (c) => fmtDate(c.date) },
              { header: "Branch", render: (c) => c.branch },
              { header: "Status", render: (c) => <Badge tone={statusTone(c.status)}>{c.status === "open" ? "Not submitted" : "Submitted"}</Badge> },
              { header: "", render: (c) => c.open_flags > 0
                  ? <button className="bg-transparent px-1.5 py-1 font-semibold text-pink-dark shadow-none hover:bg-pink-soft" onClick={() => go("discrepancies")}>{c.open_flags} open flag(s): resolve</button>
                  : c.status === "submitted" ? <button onClick={() => confirmClosing(c.close_code)}>Confirm closing</button> : <span className="text-mute">Waiting for branch</span> },
            ]}
          />
        </div>
      )}

      <Modal open={baseOpen} onClose={() => setBaseOpen(false)} title="Next opening stock baseline"
        footer={<><button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => setBaseOpen(false)}>Back to audit</button><button disabled={busy || !base.data} onClick={confirmBaseline}>Confirm next opening</button></>}>
        <p className="text-mute">Use verified branch closing stock from the signed week. This is a new-day opening snapshot, not a second physical stock receipt.</p>
        <Field label="Branch">
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>{data.branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.branch}</option>)}</select>
        </Field>
        {base.data && <DataTable rows={base.data.products} cols={[{ header: "Product", render: (p) => p.product }, { header: "Verified closing", render: (p) => p.qty, align: "right" }, { header: "Next opening", render: (p) => p.qty, align: "right" }]} />}
        <p className="text-mute">Reference: signed week {audit.week_start.slice(5)} – {audit.week_end.slice(5)} · {audit.audit_code}</p>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <ResultModal open={!!signedMsg} onClose={() => setSignedMsg(null)} title="Week signed off">
        {signedMsg && <><Notice tone="ok">Audit {audit.audit_code} closed by the Business Owner. {signedMsg.closings} / {signedMsg.closings} closings confirmed.</Notice>
          <p>Confirmed sales: {peso(signedMsg.sales)}. Verified closing stock carries into the next opening baseline.</p></>}
      </ResultModal>
      <ResultModal open={!!baseDone} onClose={() => setBaseDone("")} title="Next opening confirmed">{baseDone}</ResultModal>
    </div>
  );
}
