import { useState } from "react";
import { api } from "../../lib/axios";
import { Badge, DataTable, Field, Loading, Modal, Notice, PageHeader, ResultModal, StatCard, Stats, statusTone } from "../../components/ui";
import { useGo } from "../../lib/nav";
import { errMsg, useApi } from "../../lib/useApi";
import { DISPATCH_STATUS, fmtDateTime, fmtTime } from "../../lib/format";

interface Row { dispatch_code: string; product: string; branch: string; batch_no: string | null; sent: number; received: number | null; variance: number | null; status: string; dispatched_at: string }
interface List { in_transit: number; received_today: number; delivery_flags: number; dispatches: Row[] }
interface Detail {
  dispatch: {
    dispatch_code: string; product: string; product_code: string; branch: string; batch_no: string | null; quantity_dispatched: number; quantity_received: number | null;
    status: string; dispatched_at: string; received_at: string | null; delivery_note: string | null; prepared_by: string | null; received_by: string | null;
  };
  discrepancy: { disc_code: string; status: string } | null;
}

export default function Dispatch() {
  const { id } = useGo();
  return id ? <DispatchDetail code={id} /> : <DispatchList />;
}

function DispatchList() {
  const list = useApi<List>("/api/production/dispatches");
  const products = useApi<{ products: { product_code: string; name: string }[] }>("/api/shared/products");
  const branches = useApi<{ branches: { id: number; name: string; kind: string }[] }>("/api/shared/branches");
  const { go } = useGo();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ dispatch_code: string; hub_stock_after: number } | null>(null);
  if (!list.data) return <Loading loading={list.loading} error={list.error} />;
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const dest = branches.data?.branches.filter((b) => b.kind === "branch") ?? [];

  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await api.post("/api/production/dispatches", { product_code: form.product_code, batch_no: form.batch_no || undefined, branch_id: Number(form.branch_id), quantity: Number(form.quantity) });
      setDone(r.data); setOpen(false); list.reload();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="From our kitchen to every branch."
        subtitle="Track dispatch details, in-transit stock, receipts and delivery discrepancies."
        actions={<button onClick={() => { setForm({ product_code: products.data?.products[0]?.product_code ?? "", branch_id: String(dest[0]?.id ?? "") }); setMsg(""); setOpen(true); }}>Create dispatch</button>}
      />
      <Stats>
        <StatCard label="In transit" value={list.data.in_transit} hint="Awaiting branch receipt" />
        <StatCard label="Received today" value={list.data.received_today} hint="Confirmed deliveries" />
        <StatCard label="Delivery flags" value={list.data.delivery_flags} tone={list.data.delivery_flags ? "warn" : "ok"} hint="Review required" />
      </Stats>
      <DataTable
        rows={list.data.dispatches}
        cols={[
          { header: "Dispatch", render: (r) => r.dispatch_code },
          { header: "Branch", render: (r) => r.branch },
          { header: "Product / batch", render: (r) => `${r.product} · ${r.batch_no ?? "-"}` },
          { header: "Units", render: (r) => r.sent, align: "right" },
          { header: "Received", render: (r) => r.received ?? "-", align: "right" },
          { header: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{DISPATCH_STATUS[r.status] ?? r.status}</Badge> },
          { header: "", render: (r) => <button className="bg-transparent px-1.5 py-1 font-semibold text-pink-dark shadow-none hover:bg-pink-soft" onClick={() => go("dispatch", r.dispatch_code)}>View {r.dispatch_code}</button> },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Create a dispatch"
        footer={<><button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => setOpen(false)}>Cancel</button><button disabled={busy} onClick={save}>{busy ? "Saving..." : "Save & dispatch"}</button></>}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 max-md:grid-cols-1">
          <Field label="Product">
            <select value={form.product_code ?? ""} onChange={(e) => set("product_code", e.target.value)}>
              {products.data?.products.map((p) => <option key={p.product_code} value={p.product_code}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Destination branch">
            <select value={form.branch_id ?? ""} onChange={(e) => set("branch_id", e.target.value)}>
              {dest.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Batch number" hint="Leave blank to use the latest batch"><input value={form.batch_no ?? ""} onChange={(e) => set("batch_no", e.target.value)} placeholder="B-1108" /></Field>
          <Field label="Quantity dispatched"><input type="number" min={1} value={form.quantity ?? ""} onChange={(e) => set("quantity", e.target.value)} /></Field>
        </div>
        <Notice tone="info">Saving records the dispatch and deducts the main hub quantity. Branch stock updates only after receipt confirmation.</Notice>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>
      <ResultModal open={!!done} onClose={() => setDone(null)} title="Dispatch created" action={done ? { label: "View dispatch", onClick: () => go("dispatch", done.dispatch_code) } : undefined}>
        {done && <p>{done.dispatch_code} is in transit. Main hub stock is now {done.hub_stock_after}.</p>}
      </ResultModal>
    </div>
  );
}

function DispatchDetail({ code }: { code: string }) {
  const { data, error, loading } = useApi<Detail>(`/api/production/dispatches/${code}`);
  const { go } = useGo();
  if (!data) return <Loading loading={loading} error={error} />;
  const d = data.dispatch;
  const diff = d.quantity_received === null ? null : d.quantity_received - d.quantity_dispatched;

  return (
    <div className="grid gap-5">
      <PageHeader title={`Dispatch ${d.dispatch_code}`} subtitle={`Main hub → ${d.branch} · ${fmtDateTime(d.dispatched_at)} · Batch ${d.batch_no ?? "-"}`}
        actions={<button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => go("dispatch")}>All dispatches</button>} />
      <Stats>
        <StatCard label="Status" value={<Badge tone={statusTone(d.status)}>{DISPATCH_STATUS[d.status]}</Badge>} />
        <StatCard label="Dispatched" value={`${d.quantity_dispatched} units`} hint={d.product} />
        <StatCard label="Received" value={d.quantity_received ?? "Awaiting"} hint="Branch confirmation" />
        <StatCard label="Difference" value={diff === null ? "--" : diff} tone={diff ? "warn" : undefined} />
      </Stats>
      <div className="rounded-md border border-line bg-white  p-5 max-md:p-4">
        <h2>Dispatch timeline</h2>
        <ul className="m-0 grid list-none gap-2.5 p-0 [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:rounded-md [&>li]:border [&>li]:border-line [&>li]:bg-white [&>li]:px-3.5 [&>li]:py-2.5 max-md:[&>li]:flex-wrap">
          <li><span>{fmtTime(d.dispatched_at)} · Created by {d.prepared_by ?? "-"}</span></li>
          <li><span>{fmtTime(d.dispatched_at)} · Main hub stock deducted</span></li>
          {d.received_at
            ? <li><span>{fmtTime(d.received_at)} · Received by {d.received_by ?? "-"}: {d.quantity_received} units{d.delivery_note ? ` · “${d.delivery_note}”` : ""}</span></li>
            : <li><span className="text-mute">Pending · Branch physical receipt confirmation</span></li>}
        </ul>
      </div>
      {data.discrepancy && <Notice tone={data.discrepancy.status === "resolved" ? "ok" : "warn"}>Delivery discrepancy {data.discrepancy.disc_code} is {data.discrepancy.status}.</Notice>}
    </div>
  );
}
