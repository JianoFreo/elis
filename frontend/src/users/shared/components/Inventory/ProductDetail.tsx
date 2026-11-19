import { useState } from "react";
import { api } from "../../../../lib/axios";
import { DataTable, Field, Loading, Modal, PageHeader, StatCard, Stats } from "../../../../components/ui";
import { useGo } from "../../../../lib/nav";
import { errMsg, useApi } from "../../../../lib/useApi";
import { MOVEMENT_LABEL, fmtDate, fmtDateTime, peso, signed } from "../../../../lib/format";
import type { Detail } from "./types";

export default function ProductDetail({ code }: { code: string }) {
  const { data, error, loading, reload } = useApi<Detail>(
    `/api/production/inventory/${code}`,
  );
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
        name: form.name,
        description: form.description,
        price: Number(form.price),
        cost: Number(form.cost),
        threshold: Number(form.threshold),
        best_before: form.best_before || null,
      });
      setEdit(false);
      reload();
    } catch (e) {
      setMsg(errMsg(e));
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader
        title={p.name}
        subtitle={`${p.product_code}${data.batch ? ` · Supply batch ${data.batch.batch_no}` : ""}`}
        actions={
          <>
            <button
              onClick={() => {
                setForm({
                  name: p.name,
                  description: p.description ?? "",
                  price: String(p.price),
                  cost: String(p.cost),
                  threshold: String(p.threshold),
                  best_before: data.batch?.best_before ?? "",
                });
                setMsg("");
                setEdit(true);
              }}
            >
              Edit product details
            </button>
            <button
              className="border border-line bg-white text-ink shadow-none hover:bg-canvas"
              onClick={() => go("dispatch")}
            >
              Create dispatch
            </button>
            <button
              className="border border-line bg-white text-ink shadow-none hover:bg-canvas"
              onClick={() => go("inventory")}
            >
              Back to product
            </button>
          </>
        }
      />
      <Stats>
        <StatCard label="Unit price" value={peso(p.price)} />
        <StatCard
          label="On hand"
          value={`${data.on_hand} units`}
          hint={`Threshold: ${p.threshold} units`}
          tone={data.on_hand <= p.threshold ? "warn" : undefined}
        />
        <StatCard
          label="Best before"
          value={fmtDate(data.batch?.best_before)}
          hint={data.batch ? `batch ${data.batch.batch_no}` : undefined}
        />
      </Stats>
      <div className="rounded-md border border-line bg-white  p-5 max-md:p-4">
        <h2>Product information</h2>
        <p>
          {p.description ?? "No description."} Quantity is tracked per product,
          batch and location.
        </p>
      </div>
      <div>
        <h2>Ledger movements</h2>
        <DataTable
          rows={data.movements}
          cols={[
            { header: "Time", render: (m) => fmtDateTime(m.created_at) },
            {
              header: "Movement",
              render: (m) => MOVEMENT_LABEL[m.movement_type] ?? m.movement_type,
            },
            { header: "Location", render: (m) => m.location },
            {
              header: "Qty",
              render: (m) => <strong>{signed(m.quantity)}</strong>,
              align: "right",
            },
            { header: "Staff", render: (m) => m.staff ?? "-" },
            { header: "Reference", render: (m) => m.reference ?? "-" },
          ]}
        />
      </div>

      <Modal
        open={edit}
        onClose={() => setEdit(false)}
        title="Product master"
        footer={
          <>
            <button
              className="border border-line bg-white text-ink shadow-none hover:bg-canvas"
              onClick={() => setEdit(false)}
            >
              Cancel
            </button>
            <button onClick={save}>Save product</button>
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
              step={1}
              value={form.threshold ?? ""}
              onChange={(e) => set("threshold", e.target.value)}
            />
          </Field>
          <Field label="Best before (latest batch)">
            <input
              type="date"
              value={form.best_before ?? ""}
              onChange={(e) => set("best_before", e.target.value)}
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
    </div>
  );
}
