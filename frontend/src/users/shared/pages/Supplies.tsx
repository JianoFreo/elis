import { useState } from "react";
import { api } from "../../../lib/axios";
import { Badge, DataTable, Field, Loading, Modal, Notice, PageHeader, Progress, ResultModal, StatCard, Stats, statusTone } from "../../../components/ui";
import { currentUser, errMsg, useApi } from "../../../lib/useApi";
import { fmtDate, num, peso } from "../../../lib/format";

interface Material { material_code: string; name: string; category: string | null; unit: string; cost: number; threshold: number; supplier: string | null; on_hand: number; status: string }
interface Supplies { registered: number; low_stock: number; received_today: number; materials: Material[] }
interface Usage { date: string; records: { record_ref: string; material_code: string; material: string; unit: string; threshold: number; opening: number; received: number; closing: number | null; used: number | null }[] }

type ModalKind = "register" | "stockin" | "opening" | "closing" | null;

export default function Supplies() {
  const sup = useApi<Supplies>("/api/production/supplies");
  const usage = useApi<Usage>("/api/production/supplies/usage");
  const [tab, setTab] = useState<"materials" | "usage">("materials");
  const [modal, setModal] = useState<ModalKind>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ title: string; body: React.ReactNode } | null>(null);
  const role = currentUser().role;
  const canRegister = role === "owner" || role === "production-head";
  if (!sup.data) return <Loading loading={sup.loading} error={sup.error} />;

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const first = sup.data.materials[0]?.material_code ?? "";

  async function open(kind: ModalKind, code = first) {
    setModal(kind); setMsg(""); setForm({ material_code: code });
    if (kind === "opening") prefill(code);
  }
  async function prefill(code: string) {
    try {
      const r = await api.get("/api/production/supplies/opening-prefill", { params: { material_code: code } });
      setForm((f) => ({ ...f, material_code: code, opening_qty: String(r.data.opening_qty) }));
    } catch { /* leave blank */ }
  }

  async function save() {
    setBusy(true); setMsg("");
    try {
      if (modal === "register") {
        const r = await api.post("/api/production/materials", { name: form.name, category: form.category || null, unit: form.unit, cost: Number(form.cost), threshold: Number(form.threshold), supplier: form.supplier || null });
        setDone({ title: "Material registered", body: `${form.name} is now ${r.data.material_code}.` });
      } else if (modal === "stockin") {
        const r = await api.post("/api/production/supplies/stock-in", { material_code: form.material_code, quantity: Number(form.quantity), unit_cost: form.unit_cost ? Number(form.unit_cost) : undefined, supplier: form.supplier || undefined, received_on: form.received_on || undefined, receipt_ref: form.receipt_ref || undefined });
        setDone({ title: "Stock-in saved", body: `Receipt ${r.data.receipt_ref} recorded. The delivery was added to main hub supplies.` });
      } else if (modal === "opening") {
        const r = await api.post("/api/production/supplies/opening", { material_code: form.material_code, opening_qty: Number(form.opening_qty) });
        setDone({ title: "Opening inventory saved", body: `Opening record ${r.data.record_ref} is available for this shift's closing.` });
      } else if (modal === "closing") {
        const r = await api.post("/api/production/supplies/closing", { material_code: form.material_code, closing_qty: Number(form.closing_qty) });
        setDone({
          title: "Usage recorded",
          body: <><strong>{num(r.data.used)} {r.data.unit} used.</strong> {r.data.material}: {num(r.data.remaining)} {r.data.unit} remaining. Restock threshold: {r.data.threshold} {r.data.unit}.
            {r.data.low && <Notice tone="warn">Below the restock threshold. The Owner and Production Head can review the low-stock alert.</Notice>}</>,
        });
      }
      setModal(null); sup.reload(); usage.reload();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  }

  const select = (onChange?: (code: string) => void) => (
    <Field label="Material">
      <select value={form.material_code ?? ""} onChange={(e) => { set("material_code", e.target.value); onChange?.(e.target.value); }}>
        {sup.data!.materials.map((m) => <option key={m.material_code} value={m.material_code}>{m.name} · {m.material_code}</option>)}
      </select>
    </Field>
  );
  const unitOf = sup.data.materials.find((m) => m.material_code === form.material_code)?.unit ?? "";
  const footer = (label: string) => <><button className="border border-line bg-white text-ink shadow-none hover:bg-canvas" onClick={() => setModal(null)}>Cancel</button><button disabled={busy} onClick={save}>{busy ? "Saving..." : label}</button></>;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="The ingredients behind it all."
        subtitle="Materials, supplier sources, stock-in and daily usage."
        actions={<>
          {canRegister && <button onClick={() => open("register")}>Register material</button>}
          <button className="border border-line bg-white text-ink shadow-none hover:bg-canvas" onClick={() => open("stockin")}>Receive stock-in</button>
          <button className="border border-line bg-white text-ink shadow-none hover:bg-canvas" onClick={() => open("opening")}>Log shift opening</button>
          <button className="border border-line bg-white text-ink shadow-none hover:bg-canvas" onClick={() => open("closing")}>Log closing &amp; usage</button>
        </>}
      />
      <Stats>
        <StatCard label="Registered materials" value={sup.data.registered} hint="Supply master items" />
        <StatCard label="Low-stock materials" value={sup.data.low_stock} tone={sup.data.low_stock ? "warn" : "ok"} hint="Below their set thresholds" />
        <StatCard label="Stock received today" value={sup.data.received_today} hint="Supplier deliveries" />
      </Stats>
      <div className="mb-4 flex gap-1">
        <button className={tab === "materials" ? "border-pink bg-pink text-white" : "border border-line bg-white text-ink shadow-none hover:bg-canvas"} onClick={() => setTab("materials")}>Materials</button>
        <button className={tab === "usage" ? "border-pink bg-pink text-white" : "border border-line bg-white text-ink shadow-none hover:bg-canvas"} onClick={() => setTab("usage")}>Daily usage</button>
      </div>

      {tab === "materials" && (
        <DataTable
          rows={sup.data.materials}
          cols={[
            { header: "Material", render: (m) => m.name },
            { header: "On hand", render: (m) => num(m.on_hand), align: "right" },
            { header: "Unit", render: (m) => m.unit },
            { header: "Unit cost", render: (m) => peso(m.cost), align: "right" },
            { header: "Threshold", render: (m) => num(m.threshold), align: "right" },
            { header: "Supplier", render: (m) => m.supplier ?? "-" },
            { header: "Status", render: (m) => <Badge tone={statusTone(m.status)}>{m.status}</Badge> },
          ]}
        />
      )}
      {tab === "usage" && usage.data && (
        <>
          <p className="text-mute">{fmtDate(usage.data.date)} · opening + received − closing = used</p>
          <DataTable
            rows={usage.data.records}
            empty="No opening or closing counts logged for this day yet."
            cols={[
              { header: "Material", render: (u) => u.material },
              { header: "Opening", render: (u) => `${num(u.opening)} ${u.unit}`, align: "right" },
              { header: "Received", render: (u) => `${num(u.received)} ${u.unit}`, align: "right" },
              { header: "Used", render: (u) => (u.used === null ? "-" : `${num(u.used)} ${u.unit}`), align: "right" },
              { header: "Remaining", render: (u) => (u.closing === null ? <Badge tone="info">Shift open</Badge> : `${num(u.closing)} ${u.unit}`), align: "right" },
              { header: "Consumed", render: (u) => { const avail = u.opening + u.received; const pct = u.used === null || !avail ? 0 : (u.used / avail) * 100; return <div style={{ minWidth: 90 }}><Progress value={pct} tone={pct >= 95 ? "bad" : pct >= 70 ? "warn" : "ok"} /></div>; } },
            ]}
          />
        </>
      )}

      <Modal open={modal === "register"} onClose={() => setModal(null)} title="Register a supply item" footer={footer("Save material & threshold")}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4 max-md:grid-cols-1">
          <Field label="Name"><input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Category"><input value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="Baking flour" /></Field>
          <Field label="Unit of measurement"><input value={form.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder="kg" maxLength={10} /></Field>
          <Field label="Unit cost"><input type="number" min={0} step="0.01" value={form.cost ?? ""} onChange={(e) => set("cost", e.target.value)} /></Field>
          <Field label="Low-stock threshold"><input type="number" min={0} step="0.01" value={form.threshold ?? ""} onChange={(e) => set("threshold", e.target.value)} /></Field>
          <Field label="Supplier / source"><input value={form.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} /></Field>
        </div>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <Modal open={modal === "stockin"} onClose={() => setModal(null)} title="Receive supply stock" footer={footer("Save stock-in")}>
        {select()}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4 max-md:grid-cols-1">
          <Field label={`Quantity received${unitOf ? ` (${unitOf})` : ""}`}><input type="number" min={0} step="0.01" value={form.quantity ?? ""} onChange={(e) => set("quantity", e.target.value)} /></Field>
          <Field label="Unit cost" hint="Blank = current material cost"><input type="number" min={0} step="0.01" value={form.unit_cost ?? ""} onChange={(e) => set("unit_cost", e.target.value)} /></Field>
          <Field label="Supplier / source"><input value={form.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} /></Field>
          <Field label="Date received"><input type="date" value={form.received_on ?? ""} onChange={(e) => set("received_on", e.target.value)} /></Field>
          <Field label="Receipt reference" hint="Blank = next SUP- number"><input value={form.receipt_ref ?? ""} onChange={(e) => set("receipt_ref", e.target.value)} /></Field>
        </div>
        <p className="text-mute">Saving adds the quantity to main hub supplies.</p>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <Modal open={modal === "opening"} onClose={() => setModal(null)} title="Log shift opening inventory" footer={footer("Save opening inventory")}>
        {select(prefill)}
        <Field label={`Opening quantity${unitOf ? ` (${unitOf})` : ""}`} hint="Previous verified closing is prefilled. Check physical stock before saving.">
          <input type="number" min={0} step="0.01" value={form.opening_qty ?? ""} onChange={(e) => set("opening_qty", e.target.value)} />
        </Field>
        <Field label="Counted by"><input value={currentUser().full_name} readOnly /></Field>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <Modal open={modal === "closing"} onClose={() => setModal(null)} title="Daily closing & usage" footer={footer("Record usage")}>
        {select()}
        <Field label={`Closing stock${unitOf ? ` (${unitOf})` : ""}`} hint="Used = opening + received − closing.">
          <input type="number" min={0} step="0.01" value={form.closing_qty ?? ""} onChange={(e) => set("closing_qty", e.target.value)} />
        </Field>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <ResultModal open={!!done} onClose={() => setDone(null)} title={done?.title ?? ""}>{done?.body}</ResultModal>
    </div>
  );
}
