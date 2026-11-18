import { useState } from "react";
import { api } from "../../lib/axios";
import { Badge, DataTable, Field, Loading, Modal, PageHeader, ResultModal, StatCard, Stats, statusTone } from "../../components/ui";
import { useGo } from "../../lib/nav";
import { currentUser, errMsg, useApi } from "../../lib/useApi";
import { MOVEMENT_LABEL, fmtDate, fmtDateTime, peso, signed } from "../../lib/format";

interface Row { product_code: string; product: string; location: string; kind: string; batch_no: string | null; best_before: string | null; threshold: number; qty: number; status: string }
interface Inv { hub_total: number; branch_total: number; low_stock: number; rows: Row[] }
interface Lookup { products: { product_code: string; name: string }[] }
interface Branches { branches: { id: number; name: string; kind: string }[] }
interface Detail {
  product: { product_code: string; name: string; description: string | null; price: number; cost: number; threshold: number };
  on_hand: number; batch: { batch_no: string; best_before: string | null } | null;
  movements: { created_at: string; movement_type: string; quantity: number; reference: string | null; location: string; staff: string | null; batch_no: string | null }[];
}

export default function Inventory() {
  const { id } = useGo();
  return id ? <ProductDetail code={id} /> : <InventoryList />;
}

function InventoryList() {
  const inv = useApi<Inv>("/api/production/inventory");
  const products = useApi<Lookup>("/api/shared/products");
  const branches = useApi<Branches>("/api/shared/branches");
  const { go } = useGo();
  const [modal, setModal] = useState<"production" | "baseline" | "register" | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const isOwner = currentUser().role === "owner";
  if (!inv.data) return <Loading loading={inv.loading} error={inv.error} />;

  const open = (m: typeof modal) => { setModal(m); setForm({ product_code: products.data?.products[0]?.product_code ?? "" }); setMsg(""); };
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true); setMsg("");
    try {
      if (modal === "production") {
        const r = await api.post("/api/production/production-output", { product_code: form.product_code, batch_no: form.batch_no, quantity: Number(form.quantity), best_before: form.best_before || null });
        setDone(`Production ${r.data.production_ref}: ${r.data.quantity} × ${r.data.product} added to the main hub (batch ${r.data.batch_no}).`);
      } else if (modal === "baseline") {
        await api.post("/api/production/stock-baseline", { product_code: form.product_code, batch_no: form.batch_no, branch_id: Number(form.branch_id), quantity: Number(form.quantity), reference: form.reference || null });
        setDone("Stock movement saved to the ledger.");
      } else if (modal === "register") {
        await api.post("/api/owner/products", { name: form.name, description: form.description || null, price: Number(form.price), cost: Number(form.cost), threshold: Number(form.threshold || 0) });
        setDone("Product registered.");
      }
      setModal(null); inv.reload(); products.reload();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  }

  const productSelect = (
    <Field label="Product">
      <select value={form.product_code ?? ""} onChange={(e) => set("product_code", e.target.value)}>
        {products.data?.products.map((p) => <option key={p.product_code} value={p.product_code}>{p.name} · {p.product_code}</option>)}
      </select>
    </Field>
  );

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Every batch, accounted for."
        subtitle="Central kitchen and branch ledgers"
        actions={<>
          <button onClick={() => open("production")}>Record production output</button>
          {isOwner && <button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => open("register")}>Register product</button>}
          <button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => open("baseline")}>Receive stock / set baseline</button>
        </>}
      />
      <Stats>
        <StatCard label="Main hub stock" value={inv.data.hub_total} hint="Finished product units" />
        <StatCard label="Branch stock" value={inv.data.branch_total} hint="Across all branches" />
        <StatCard label="Low-stock products" value={inv.data.low_stock} tone={inv.data.low_stock ? "warn" : "ok"} hint="Review reorder thresholds" />
      </Stats>
      <DataTable
        rows={inv.data.rows}
        cols={[
          { header: "Product / batch", render: (r) => `${r.product} · ${r.batch_no ?? "-"}` },
          { header: "Location", render: (r) => r.location },
          { header: "Qty", render: (r) => r.qty, align: "right" },
          { header: "Best before", render: (r) => fmtDate(r.best_before) },
          { header: "Threshold", render: (r) => r.threshold, align: "right" },
          { header: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
          { header: "", render: (r) => <button className="bg-transparent px-1.5 py-1 font-semibold text-pink-dark shadow-none hover:bg-pink-soft" onClick={() => go("inventory", r.product_code)}>View product &amp; ledger</button> },
        ]}
      />

      <Modal
        open={modal === "production"} onClose={() => setModal(null)} title="Record production output"
        footer={<><button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => setModal(null)}>Cancel</button><button disabled={busy} onClick={save}>Save production output</button></>}
      >
        {productSelect}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 max-md:grid-cols-1">
          <Field label="Batch number"><input value={form.batch_no ?? ""} onChange={(e) => set("batch_no", e.target.value)} placeholder="B-1109" /></Field>
          <Field label="Quantity produced"><input type="number" min={1} value={form.quantity ?? ""} onChange={(e) => set("quantity", e.target.value)} /></Field>
          <Field label="Best before"><input type="date" value={form.best_before ?? ""} onChange={(e) => set("best_before", e.target.value)} /></Field>
        </div>
        <p className="text-mute">Saving adds the units to the main hub and records the batch in the product ledger.</p>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <Modal
        open={modal === "baseline"} onClose={() => setModal(null)} title="Stock baseline & received stock"
        footer={<><button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => setModal(null)}>Cancel</button><button disabled={busy} onClick={save}>Save stock movement</button></>}
      >
        {productSelect}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 max-md:grid-cols-1">
          <Field label="Batch number"><input value={form.batch_no ?? ""} onChange={(e) => set("batch_no", e.target.value)} placeholder="B-1108" /></Field>
          <Field label="Location">
            <select value={form.branch_id ?? ""} onChange={(e) => set("branch_id", e.target.value)}>
              <option value="">Choose a location</option>
              {branches.data?.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Quantity"><input type="number" min={1} value={form.quantity ?? ""} onChange={(e) => set("quantity", e.target.value)} /></Field>
          <Field label="Reason / reference"><input value={form.reference ?? ""} onChange={(e) => set("reference", e.target.value)} placeholder="Opening stock baseline · BASE-1108" /></Field>
        </div>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <Modal
        open={modal === "register"} onClose={() => setModal(null)} title="Register product"
        footer={<><button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => setModal(null)}>Cancel</button><button disabled={busy} onClick={save}>Save product</button></>}
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 max-md:grid-cols-1">
          <Field label="Name"><input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Unit price"><input type="number" min={0} step="0.01" value={form.price ?? ""} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Unit cost"><input type="number" min={0} step="0.01" value={form.cost ?? ""} onChange={(e) => set("cost", e.target.value)} /></Field>
          <Field label="Low-stock threshold"><input type="number" min={0} value={form.threshold ?? ""} onChange={(e) => set("threshold", e.target.value)} /></Field>
          <div className="col-span-full"><Field label="Description"><textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field></div>
        </div>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <ResultModal open={!!done} onClose={() => setDone("")} title="Saved">{done}</ResultModal>
    </div>
  );
}

function ProductDetail({ code }: { code: string }) {
  const { data, error, loading, reload } = useApi<Detail>(`/api/production/inventory/${code}`);
  const { go } = useGo();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  if (!data) return <Loading loading={loading} error={error} />;
  const p = data.product;
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setMsg("");
    try {
      await api.patch(`/api/production/products/${code}`, {
        name: form.name, description: form.description, price: Number(form.price), threshold: Number(form.threshold), best_before: form.best_before || undefined,
      });
      setEdit(false); reload();
    } catch (e) { setMsg(errMsg(e)); }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title={p.name}
        subtitle={`${p.product_code}${data.batch ? ` · Supply batch ${data.batch.batch_no}` : ""}`}
        actions={<>
          <button onClick={() => { setForm({ name: p.name, description: p.description ?? "", price: String(p.price), threshold: String(p.threshold), best_before: data.batch?.best_before ?? "" }); setMsg(""); setEdit(true); }}>Edit product details</button>
          <button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => go("dispatch")}>Create dispatch</button>
          <button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => go("inventory")}>Back to inventory</button>
        </>}
      />
      <Stats>
        <StatCard label="Unit price" value={peso(p.price)} />
        <StatCard label="On hand" value={`${data.on_hand} units`} hint={`Threshold: ${p.threshold} units`} tone={data.on_hand <= p.threshold ? "warn" : undefined} />
        <StatCard label="Best before" value={fmtDate(data.batch?.best_before)} hint={data.batch ? `batch ${data.batch.batch_no}` : undefined} />
      </Stats>
      <div className="rounded-md border border-line bg-white  p-5 max-md:p-4"><h2>Product information</h2><p>{p.description ?? "No description."} Quantity is tracked per product, batch and location.</p></div>
      <div>
        <h2>Ledger movements</h2>
        <DataTable
          rows={data.movements}
          cols={[
            { header: "Time", render: (m) => fmtDateTime(m.created_at) },
            { header: "Movement", render: (m) => MOVEMENT_LABEL[m.movement_type] ?? m.movement_type },
            { header: "Location", render: (m) => m.location },
            { header: "Qty", render: (m) => <strong>{signed(m.quantity)}</strong>, align: "right" },
            { header: "Staff", render: (m) => m.staff ?? "-" },
            { header: "Reference", render: (m) => m.reference ?? "-" },
          ]}
        />
      </div>

      <Modal open={edit} onClose={() => setEdit(false)} title="Product master" footer={<><button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => setEdit(false)}>Cancel</button><button onClick={save}>Save product</button></>}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 max-md:grid-cols-1">
          <Field label="Name"><input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Unit price"><input type="number" step="0.01" value={form.price ?? ""} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Low-stock threshold"><input type="number" value={form.threshold ?? ""} onChange={(e) => set("threshold", e.target.value)} /></Field>
          <Field label="Best before (latest batch)"><input type="date" value={form.best_before ?? ""} onChange={(e) => set("best_before", e.target.value)} /></Field>
          <div className="col-span-full"><Field label="Description"><textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field></div>
        </div>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>
    </div>
  );
}
