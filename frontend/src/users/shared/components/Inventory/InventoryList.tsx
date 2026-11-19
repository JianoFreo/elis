import { useState } from "react";
import { newReference } from "../../../../lib/offlineSales";
import { api } from "../../../../lib/axios";
import { Badge, DataTable, Field, Loading, Modal, PageHeader, ResultModal, StatCard, Stats, statusTone } from "../../../../components/ui";
import { useGo } from "../../../../lib/nav";
import { currentUser, errMsg, useApi } from "../../../../lib/useApi";
import { fmtDate } from "../../../../lib/format";
import type { Inv, Lookup, Branches } from "./types";

export default function InventoryList() {
  const inv = useApi<Inv>("/api/production/inventory");
  const products = useApi<Lookup>("/api/shared/products");
  const branches = useApi<Branches>("/api/shared/branches");
  const { go } = useGo();
  const [modal, setModal] = useState<
    "production" | "baseline" | "register" | null
  >(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const isOwner = currentUser().role === "owner";
  if (!inv.data) return <Loading loading={inv.loading} error={inv.error} />;

  const open = (m: typeof modal) => {
    setModal(m);
    setForm({
      product_code: products.data?.products[0]?.product_code ?? "",
      request_ref: newReference(),
      reference: newReference(),
      entry_type: "received",
    });
    setMsg("");
  };
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      if (
        modal === "register" &&
        (!form.name?.trim() ||
          form.price === undefined ||
          form.price === "" ||
          form.cost === undefined ||
          form.cost === "")
      )
        throw new Error("Enter a name, unit price and unit cost.");
      if (
        (modal === "production" || modal === "baseline") &&
        (!form.batch_no?.trim() || !form.quantity?.trim())
      )
        throw new Error("Enter a batch number and quantity.");
      if (modal === "baseline" && !form.branch_id)
        throw new Error("Choose a stock location.");
      if (modal === "production") {
        const r = await api.post("/api/production/production-output", {
          product_code: form.product_code,
          batch_no: form.batch_no,
          quantity: Number(form.quantity),
          best_before: form.best_before || null,
          request_ref: form.request_ref,
        });
        setDone(
          `Production ${r.data.production_ref}: ${r.data.quantity} × ${r.data.product} added to the main hub (batch ${r.data.batch_no}).`,
        );
      } else if (modal === "baseline") {
        await api.post("/api/production/stock-baseline", {
          product_code: form.product_code,
          batch_no: form.batch_no,
          branch_id: Number(form.branch_id),
          quantity: Number(form.quantity),
          reference: form.reference,
          entry_type: form.entry_type,
        });
        setDone("Stock movement saved to the ledger.");
      } else if (modal === "register") {
        await api.post("/api/production/products", {
          name: form.name,
          description: form.description || null,
          price: Number(form.price),
          cost: Number(form.cost),
          threshold: Number(form.threshold || 0),
        });
        setDone("Product registered.");
      }
      setModal(null);
      inv.reload();
      products.reload();
    } catch (e) {
      setMsg(errMsg(e, (e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const productSelect = (
    <Field label="Product">
      <select
        value={form.product_code ?? ""}
        onChange={(e) => set("product_code", e.target.value)}
      >
        {products.data?.products.map((p) => (
          <option key={p.product_code} value={p.product_code}>
            {p.name} · {p.product_code}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Every batch, accounted for."
        subtitle="Central kitchen and branch ledgers"
        actions={
          <>
            <button onClick={() => open("production")}>
              Record production output
            </button>
            {(isOwner || currentUser().role === "production-head") && (
              <button
                className="border border-line bg-white text-ink shadow-none hover:bg-canvas"
                onClick={() => open("register")}
              >
                Register product
              </button>
            )}
            <button
              className="border border-line bg-white text-ink shadow-none hover:bg-canvas"
              onClick={() => open("baseline")}
            >
              Receive stock / set baseline
            </button>
          </>
        }
      />
      <Stats>
        <StatCard
          label="Main hub stock"
          value={inv.data.hub_total}
          hint="Finished product units"
        />
        <StatCard
          label="Branch stock"
          value={inv.data.branch_total}
          hint="Across all branches"
        />
        <StatCard
          label="Low-stock products"
          value={inv.data.low_stock}
          tone={inv.data.low_stock ? "warn" : "ok"}
          hint="Review reorder thresholds"
        />
      </Stats>
      <DataTable
        rows={inv.data.rows}
        cols={[
          {
            header: "Product / batch",
            render: (r) => `${r.product} · ${r.batch_no ?? "-"}`,
          },
          { header: "Location", render: (r) => r.location },
          { header: "Qty", render: (r) => r.qty, align: "right" },
          { header: "Best before", render: (r) => fmtDate(r.best_before) },
          { header: "Threshold", render: (r) => r.threshold, align: "right" },
          {
            header: "Status",
            render: (r) => (
              <Badge tone={statusTone(r.status)}>{r.status}</Badge>
            ),
          },
          {
            header: "",
            render: (r) => (
              <button
                className="bg-transparent px-1.5 py-1 font-semibold text-pink-dark shadow-none hover:bg-pink-soft"
                onClick={() => go("inventory", r.product_code)}
              >
                View product &amp; ledger
              </button>
            ),
          },
        ]}
      />

      <Modal
        open={modal === "production"}
        onClose={() => setModal(null)}
        title="Record production output"
        footer={
          <>
            <button
              className="border border-line bg-white text-ink shadow-none hover:bg-canvas"
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button disabled={busy} onClick={save}>
              Save production output
            </button>
          </>
        }
      >
        {productSelect}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4 max-md:grid-cols-1">
          <Field label="Batch number">
            <input
              value={form.batch_no ?? ""}
              onChange={(e) => set("batch_no", e.target.value)}
              placeholder="B-1109"
            />
          </Field>
          <Field label="Quantity produced">
            <input
              type="number"
              min={1}
              step={1}
              value={form.quantity ?? ""}
              onChange={(e) => set("quantity", e.target.value)}
            />
          </Field>
          <Field label="Best before">
            <input
              type="date"
              value={form.best_before ?? ""}
              onChange={(e) => set("best_before", e.target.value)}
            />
          </Field>
        </div>
        <p className="text-mute">
          Saving adds the units to the main hub and records the batch in the
          product ledger.
        </p>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <Modal
        open={modal === "baseline"}
        onClose={() => setModal(null)}
        title="Stock baseline & received stock"
        footer={
          <>
            <button
              className="border border-line bg-white text-ink shadow-none hover:bg-canvas"
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button disabled={busy} onClick={save}>
              Save stock movement
            </button>
          </>
        }
      >
        <Field label="Entry type">
          <select
            value={form.entry_type ?? "received"}
            onChange={(e) => set("entry_type", e.target.value)}
          >
            <option value="received">External received stock</option>
            <option value="opening">
              Initial opening baseline (empty ledger only)
            </option>
          </select>
        </Field>
        <p className="text-mute">
          For deliveries from the main hub, use Confirm branch receipt instead.
          Reusing this reference safely retries the same entry.
        </p>
        {productSelect}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4 max-md:grid-cols-1">
          <Field label="Batch number">
            <input
              value={form.batch_no ?? ""}
              onChange={(e) => set("batch_no", e.target.value)}
              placeholder="B-1108"
            />
          </Field>
          <Field label="Location">
            <select
              aria-label="Location"
              value={form.branch_id ?? ""}
              onChange={(e) => set("branch_id", e.target.value)}
            >
              <option value="">Choose a location</option>
              {branches.data?.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity">
            <input
              type="number"
              min={1}
              step={1}
              value={form.quantity ?? ""}
              onChange={(e) => set("quantity", e.target.value)}
            />
          </Field>
          <Field label="Reason / reference">
            <input
              value={form.reference ?? ""}
              onChange={(e) => set("reference", e.target.value)}
              placeholder="Opening stock baseline · BASE-1108"
            />
          </Field>
        </div>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <Modal
        open={modal === "register"}
        onClose={() => setModal(null)}
        title="Register product"
        footer={
          <>
            <button
              className="border border-line bg-white text-ink shadow-none hover:bg-canvas"
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button disabled={busy} onClick={save}>
              Save product
            </button>
          </>
        }
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4 max-md:grid-cols-1">
          <Field label="Name">
            <input
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Unit price">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.price ?? ""}
              onChange={(e) => set("price", e.target.value)}
            />
          </Field>
          <Field label="Unit cost">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.cost ?? ""}
              onChange={(e) => set("cost", e.target.value)}
            />
          </Field>
          <Field label="Low-stock threshold">
            <input
              type="number"
              min={0}
              value={form.threshold ?? ""}
              onChange={(e) => set("threshold", e.target.value)}
            />
          </Field>
          <div className="col-span-full">
            <Field label="Description">
              <textarea
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
          </div>
        </div>
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <ResultModal open={!!done} onClose={() => setDone("")} title="Saved">
        {done}
      </ResultModal>
    </div>
  );
}
