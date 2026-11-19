import { useState } from "react";
import { api } from "../../../lib/axios";
import { DataTable, Field, Loading, Modal, Notice, PageHeader, ResultModal } from "../../../components/ui";
import { useGo } from "../../../lib/nav";
import { currentUser, errMsg, useApi } from "../../../lib/useApi";
import { fmtDateTime } from "../../../lib/format";

interface Incoming { dispatches: { dispatch_code: string; product: string; batch_no: string | null; quantity_dispatched: number; dispatched_at: string }[] }
interface Receipt { dispatch_code: string; receipt_ref: string; dispatched: number; received: number; variance: number; discrepancy: string | null }

export default function Deliveries() {
  const { data, error, loading, reload } = useApi<Incoming>("/api/sales/dispatches/incoming");
  const { go } = useGo();
  const [target, setTarget] = useState<Incoming["dispatches"][number] | null>(null);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<Receipt | null>(null);
  if (!data) return <Loading loading={loading} error={error} />;

  const n = Number(qty);
  const valid = target && qty !== "" && Number.isInteger(n) && n >= 0 && n <= target.quantity_dispatched;

  async function confirm() {
    if (!target) return;
    setBusy(true); setMsg("");
    try {
      setResult((await api.post(`/api/sales/dispatches/${target.dispatch_code}/receive`, { quantity_received: n, delivery_note: note || null })).data);
      setTarget(null); reload();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5">
      <PageHeader title="Incoming deliveries" subtitle="Count the physical delivery before updating the branch ledger." />
      <DataTable
        rows={data.dispatches}
        empty="No deliveries in transit to your branch."
        cols={[
          { header: "Dispatch", render: (d) => d.dispatch_code },
          { header: "Product / batch", render: (d) => `${d.product} · ${d.batch_no ?? "-"}` },
          { header: "Dispatched", render: (d) => d.quantity_dispatched, align: "right" },
          { header: "Sent", render: (d) => fmtDateTime(d.dispatched_at) },
          { header: "", render: (d) => <button onClick={() => { setTarget(d); setQty(String(d.quantity_dispatched)); setNote(""); setMsg(""); }}>Confirm receipt</button> },
        ]}
      />

      <Modal
        open={!!target} onClose={() => setTarget(null)} title={`Confirm branch receipt · ${target?.dispatch_code ?? ""}`}
        footer={<><button className="border border-line bg-white text-ink shadow-none hover:bg-surface-alt" onClick={() => setTarget(null)}>Cancel</button><button disabled={!valid || busy} onClick={confirm}>{busy ? "Saving..." : "Confirm actual receipt"}</button></>}
      >
        {target && (
          <>
            <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1.5 max-md:grid-cols-1 max-md:gap-y-0.5 [&_dt]:text-mute [&_dd]:m-0 [&_dd]:font-medium max-md:[&_dd]:mb-2"><dt>Product / batch</dt><dd>{target.product} · {target.batch_no}</dd><dt>Dispatched</dt><dd>{target.quantity_dispatched}</dd><dt>Received by</dt><dd>{currentUser().full_name}</dd></dl>
            <Field label="Actual received"><input type="number" min={0} max={target.quantity_dispatched} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Field label="Delivery note"><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Two units missing from sealed delivery." /></Field>
            {valid && n !== target.quantity_dispatched && <Notice tone="warn">{n} received versus {target.quantity_dispatched} dispatched: a delivery discrepancy of {n - target.quantity_dispatched} will be flagged. The branch receives the actual quantity.</Notice>}
            {msg && <p className="m-0 text-danger">{msg}</p>}
          </>
        )}
      </Modal>

      <ResultModal open={!!result} onClose={() => setResult(null)} title="Receipt confirmed" action={result?.discrepancy ? { label: "Go to summary", onClick: () => go("summary") } : undefined}>
        {result && (
          <>
            <Notice tone={result.variance ? "warn" : "ok"}>{result.dispatch_code}: {result.received} units received.</Notice>
            <p className="text-mute">Branch ledger +{result.received}. {result.variance ? `Delivery variance ${result.variance} units; owner alert ${result.discrepancy} created.` : "Matches the dispatch."} The hub was already deducted at dispatch.</p>
          </>
        )}
      </ResultModal>
    </div>
  );
}
