import { useState } from "react";
import { api } from "../../../lib/axios";
import { Field, Loading, Notice, PageHeader, ResultModal } from "../../../components/ui";
import { useGo } from "../../../lib/nav";
import { errMsg, useApi } from "../../../lib/useApi";
import { peso } from "../../../lib/format";

interface Workspace { products: { product_code: string; name: string; price: number; expected: number }[] }
interface Result { status: string; txn_code: string | null; local_ref: string | null; line_total: number; product: string; quantity: number; stock_after?: number; stock_before?: number }

export default function RecordSale() {
  const { data, error, loading, reload } = useApi<Workspace>("/api/sales/workspace");
  const { go } = useGo();
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("1");
  const [offline, setOffline] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  if (!data) return <Loading loading={loading} error={error} />;

  const product = data.products.find((p) => p.product_code === (code || data.products[0]?.product_code));
  const n = Number(qty);
  const valid = !!product && Number.isInteger(n) && n > 0;
  const tooMany = !!product && !offline && n > product.expected;

  async function confirm() {
    if (!product) return;
    setBusy(true); setMsg("");
    try {
      const r = await api.post("/api/sales/sales", { product_code: product.product_code, quantity: n, offline });
      setResult(r.data); setQty("1"); reload();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5">
      <PageHeader title="Record a sale" subtitle="Capture the product and quantity. A confirmed sale reduces the branch stock ledger." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5 max-md:grid-cols-1">
        <form className="rounded-md border border-line bg-white  p-5 max-md:p-4 grid gap-4" onSubmit={(e) => { e.preventDefault(); confirm(); }}>
          <h2>Sale details</h2>
          <Field label="Product">
            <select value={product?.product_code ?? ""} onChange={(e) => setCode(e.target.value)}>
              {data.products.map((p) => <option key={p.product_code} value={p.product_code}>{p.name} · {p.product_code}</option>)}
            </select>
          </Field>
          <Field label="Quantity" hint={product ? `${product.expected} in stock at this branch` : undefined}>
            <input type="number" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} required />
          </Field>
          <Field label="Unit price"><input value={product ? product.price.toFixed(2) : ""} readOnly /></Field>
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={offline} onChange={(e) => setOffline(e.target.checked)} />
            Queue offline (no connection)
          </label>
          {tooMany && <Notice tone="bad">Only {product!.expected} {product!.name} available. Reduce the quantity.</Notice>}
          {msg && <p className="m-0 text-danger">{msg}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!valid || tooMany || busy}>{busy ? "Saving..." : offline ? "Queue sale" : "Confirm sale"}</button>
            <button type="button" className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => go("workspace")}>Back to sales</button>
          </div>
        </form>

        <div className="rounded-md border border-line bg-white  p-5 max-md:p-4 grid gap-5">
          <h2>Transaction preview</h2>
          <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1.5 max-md:grid-cols-1 max-md:gap-y-0.5 [&_dt]:text-mute [&_dd]:m-0 [&_dd]:font-medium max-md:[&_dd]:mb-2">
            <dt>Product</dt><dd>{product?.name ?? "-"}</dd>
            <dt>Line total</dt><dd>{valid ? peso(n * product!.price) : "-"}</dd>
            <dt>Branch stock</dt><dd>{valid && !offline ? `-${n} units` : "No change until synced"}</dd>
            <dt>Mode</dt><dd>{offline ? "Queued offline" : "Online · ready to sync"}</dd>
          </dl>
        </div>
      </div>

      <ResultModal
        open={!!result} onClose={() => setResult(null)}
        title={result?.status === "queued" ? "Sale queued" : "Sale recorded"}
        action={{ label: "Offline queue / workspace", onClick: () => go(result?.status === "queued" ? "queue" : "workspace") }}
      >
        {result && (
          <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1.5 max-md:grid-cols-1 max-md:gap-y-0.5 [&_dt]:text-mute [&_dd]:m-0 [&_dd]:font-medium max-md:[&_dd]:mb-2">
            <dt>Reference</dt><dd>{result.txn_code ?? result.local_ref}</dd>
            <dt>Item</dt><dd>{result.product} × {result.quantity}</dd>
            <dt>Line total</dt><dd>{peso(result.line_total)}</dd>
            {result.stock_after !== undefined && <><dt>Branch stock</dt><dd>{result.stock_before} → {result.stock_after} units</dd></>}
          </dl>
        )}
      </ResultModal>
    </div>
  );
}
