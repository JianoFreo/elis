import { useState } from "react";
import { api } from "../../../../lib/axios";
import { Badge, DataTable, Field, Loading, Modal, Notice, PageHeader, ResultModal, StatCard, Stats, statusTone } from "../../../../components/ui";
import { useGo } from "../../../../lib/nav";
import { errMsg, useApi } from "../../../../lib/useApi";
import { DISPATCH_STATUS } from "../../../../lib/format";
import type { List } from "./types";

export default function DispatchList() {
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
        footer={<><button className="border border-line bg-white text-ink shadow-none hover:bg-surface-alt" onClick={() => setOpen(false)}>Cancel</button><button disabled={busy} onClick={save}>{busy ? "Saving..." : "Save & dispatch"}</button></>}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(var(--spacing-col),1fr))] gap-4 max-md:grid-cols-1">
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
