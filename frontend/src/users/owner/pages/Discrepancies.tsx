import { useState } from "react";
import { api } from "../../../lib/axios";
import { Badge, DataTable, Field, Loading, Modal, Notice, PageHeader, ResultModal, StatCard, Stats, statusTone } from "../../../components/ui";
import { useGo } from "../../../lib/nav";
import { currentUser, errMsg, useApi } from "../../../lib/useApi";
import { fmtDateTime, signed } from "../../../lib/format";

interface Disc {
  disc_code: string; source_type: "count" | "delivery"; source_ref: string; status: string; expected_qty: number; actual_qty: number; variance: number;
  note: string | null; reason: string | null; created_at: string; resolved_at: string | null; branch: string; product: string; created_by: string | null; reviewed_by: string | null;
}
interface List { open_flags: number; open_counts: number; open_deliveries: number; adjustments_this_week: number; awaiting_recount: number; discrepancies: Disc[] }
interface Detail {
  discrepancy: Disc;
  dispatch: { dispatch_code: string; receipt_ref: string | null; quantity_dispatched: number; quantity_received: number | null; received_at: string | null; delivery_note: string | null; batch_no: string | null; received_by: string | null } | null;
}

const statusLabel = (s: string) => (s === "open" ? "Review pending" : s === "recount" ? "Awaiting recount" : "Resolved");

export default function Discrepancies() {
  const { id } = useGo();
  return id ? <DiscrepancyDetail code={id} /> : <DiscrepancyList />;
}

function DiscrepancyList() {
  const { data, error, loading } = useApi<List>("/api/owner/discrepancies");
  const { go } = useGo();
  if (!data) return <Loading loading={loading} error={error} />;
  return (
    <div className="grid gap-5">
      <PageHeader title="Review, resolve, reconcile." subtitle="Owner review queue" />
      <Stats>
        <StatCard label="Open flags" value={data.open_flags} tone={data.open_flags ? "warn" : "ok"} hint={`${data.open_counts} count · ${data.open_deliveries} delivery`} />
        <StatCard label="Adjustments approved" value={data.adjustments_this_week} hint="This week" />
        <StatCard label="Awaiting recount" value={data.awaiting_recount} hint="Branch follow-up" />
      </Stats>
      <DataTable
        rows={data.discrepancies}
        cols={[
          { header: "Flag", render: (d) => d.disc_code },
          { header: "Source", render: (d) => (d.source_type === "count" ? "Branch count" : d.source_ref) },
          { header: "Branch / product", render: (d) => `${d.branch} · ${d.product}` },
          { header: "Expected", render: (d) => d.expected_qty, align: "right" },
          { header: "Actual", render: (d) => d.actual_qty, align: "right" },
          { header: "Variance", render: (d) => <strong>{signed(d.variance)}</strong>, align: "right" },
          { header: "Status", render: (d) => <Badge tone={statusTone(statusLabel(d.status))}>{statusLabel(d.status)}</Badge> },
          { header: "", render: (d) => <button className="bg-transparent px-1.5 py-1 font-semibold text-pink-dark shadow-none hover:bg-pink-soft" onClick={() => go("discrepancies", d.disc_code)}>Review {d.disc_code}</button> },
        ]}
      />
    </div>
  );
}

function DiscrepancyDetail({ code }: { code: string }) {
  const { data, error, loading, reload } = useApi<Detail>(`/api/owner/discrepancies/${code}`);
  const { go } = useGo();
  const [modal, setModal] = useState<"adjust" | "resolve" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<React.ReactNode>(null);
  if (!data) return <Loading loading={loading} error={error} />;
  const d = data.discrepancy;
  const isCount = d.source_type === "count";
  const resolved = d.status === "resolved";

  async function run(path: string, body?: object, ok?: (r: any) => React.ReactNode) {
    setBusy(true); setMsg("");
    try {
      const r = await api.post(`/api/owner/discrepancies/${code}/${path}`, body);
      setModal(null); setReason("");
      setDone(ok ? ok(r.data) : r.data.message);
      reload();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title={isCount ? `Discrepancy ${d.disc_code}` : `Delivery discrepancy · ${d.disc_code}`}
        subtitle={`${d.branch} · ${d.product} · ${fmtDateTime(d.created_at)}`}
        actions={<button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => go("discrepancies")}>Back to flags</button>}
      />
      <Stats>
        <StatCard label="Status" value={<Badge tone={statusTone(statusLabel(d.status))}>{statusLabel(d.status)}</Badge>} />
        <StatCard label={isCount ? "Expected" : "Dispatched"} value={`${d.expected_qty} units`} hint={isCount ? "From the stock ledger" : d.source_ref} />
        <StatCard label={isCount ? "Physical count" : "Actual received"} value={`${d.actual_qty} units`} hint={d.created_by ? `Counted by ${d.created_by}` : undefined} />
        <StatCard label="Variance" value={`${signed(d.variance)} units`} tone="warn" hint={isCount ? "Below expected" : "Actual minus dispatched"} />
      </Stats>

      <div className="rounded-xl border border-line bg-white shadow-sm p-5 max-md:p-4 grid gap-5">
        <h2>Evidence &amp; notes</h2>
        {d.note && <p>{isCount ? "Closing note" : "Delivery note"}: “{d.note}”</p>}
        {isCount && <p className="text-mute">Source record: daily closing {d.source_ref}</p>}
        {data.dispatch && (
          <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1.5 max-md:grid-cols-1 max-md:gap-y-0.5 [&_dt]:text-mute [&_dd]:m-0 [&_dd]:font-medium max-md:[&_dd]:mb-2">
            <dt>Dispatch</dt><dd>{data.dispatch.dispatch_code} · batch {data.dispatch.batch_no ?? "-"}</dd>
            <dt>Quantity</dt><dd>{data.dispatch.quantity_dispatched} dispatched; {data.dispatch.quantity_received ?? "-"} received</dd>
            <dt>Receipt</dt><dd>{data.dispatch.receipt_ref ?? "-"} · {fmtDateTime(data.dispatch.received_at)} · {data.dispatch.received_by ?? "-"}</dd>
          </dl>
        )}
        {!isCount && !resolved && <Notice tone="warn">The main hub deduction is already recorded and the receipt added the actual {d.actual_qty} units. Do not credit the missing units or deduct the hub stock a second time.</Notice>}
        {isCount && !resolved && <Notice tone="info">Approval records the reason, reviewer and adjustment. Recount leaves the ledger unchanged.</Notice>}
        {resolved && <Notice tone="ok">Resolved by {d.reviewed_by ?? "-"} · {fmtDateTime(d.resolved_at)} · “{d.reason}”</Notice>}
        {!resolved && (
          <div className="flex flex-wrap gap-2">
            {isCount
              ? <button onClick={() => { setReason(d.note ?? ""); setMsg(""); setModal("adjust"); }}>Review stock adjustment</button>
              : <button onClick={() => { setReason(""); setMsg(""); setModal("resolve"); }}>Review delivery resolution</button>}
            {d.status === "open" && <button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => run("recount", undefined, () => "Recount requested. The ledger is unchanged.")}>{isCount ? "Request recount" : "Recount delivery"}</button>}
          </div>
        )}
      </div>

      <Modal
        open={modal === "adjust"} onClose={() => setModal(null)} title="Approve stock adjustment?"
        footer={<><button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => setModal(null)}>Cancel</button>
          <button disabled={busy || !reason.trim()} onClick={() => run("approve-adjustment", { reason }, (r) => <>Ledger adjusted by {signed(r.adjustment)} units; {d.product} at {d.branch} is now {r.stock_after}. Audit trail: {currentUser().full_name} · “{reason}”.</>)}>Approve adjustment</button></>}
      >
        <p>Only the Business Owner approves a reconciled ledger adjustment.</p>
        <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1.5 max-md:grid-cols-1 max-md:gap-y-0.5 [&_dt]:text-mute [&_dd]:m-0 [&_dd]:font-medium max-md:[&_dd]:mb-2"><dt>Adjustment</dt><dd>{signed(d.variance)} units · {d.product}</dd><dt>Approved by</dt><dd>{currentUser().full_name} · Business Owner</dd></dl>
        <Field label="Reason"><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Verified damaged goods" /></Field>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <Modal
        open={modal === "resolve"} onClose={() => setModal(null)} title="Resolve delivery discrepancy?"
        footer={<><button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => setModal(null)}>Cancel</button>
          <button disabled={busy || !reason.trim()} onClick={() => run("resolve-delivery", { reason }, () => <>{d.disc_code} resolved. Branch credit remains +{d.actual_qty} units; hub deduction remains -{d.expected_qty} units. Audit trail: {currentUser().full_name} · “{reason}”.</>)}>Confirm delivery resolution</button></>}
      >
        <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1.5 max-md:grid-cols-1 max-md:gap-y-0.5 [&_dt]:text-mute [&_dd]:m-0 [&_dd]:font-medium max-md:[&_dd]:mb-2"><dt>Source</dt><dd>{d.disc_code} · {d.source_ref}</dd><dt>Verified received</dt><dd>{d.actual_qty} units</dd></dl>
        <Field label="Resolution reason"><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Verified 2-unit shortage; actual receipt retained" /></Field>
        <p className="text-mute">Resolving keeps the branch credit at {d.actual_qty}. It records the reason and owner decision; it does not add the missing units.</p>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <ResultModal open={!!done} onClose={() => setDone(null)} title={isCount ? "Adjustment / recount" : "Delivery exception"} action={{ label: "Review queue", onClick: () => go("discrepancies") }}>{done}</ResultModal>
    </div>
  );
}
