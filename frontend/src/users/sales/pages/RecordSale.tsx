import { useState } from "react";
import { api } from "../../../lib/axios";
import { Button, Field, Input, Loading, Notice, PageHeader, ResultModal, Select } from "../../../components/ui";
import { useGo } from "../../../lib/nav";
import { errMsg } from "../../../lib/useApi";
import { peso } from "../../../lib/format";
import {
  captureTime,
  enqueueSale,
  newReference,
  removeLocalSale,
  reservedQuantity,
  salePayload,
} from "../../../lib/offlineSales";
import {
  useLocalSales,
  useSalesWorkspace,
} from "../../../lib/useSalesWorkspace";
interface Result {
  status: string;
  txn_code: string | null;
  local_ref: string | null;
  line_total: number;
  product: string;
  quantity: number;
  stock_after?: number;
  stock_before?: number;
}
export default function RecordSale() {
  const { data, error, loading, stale, reload } = useSalesWorkspace(),
    outbox = useLocalSales(),
    { go } = useGo();
  const [code, setCode] = useState(""),
    [qty, setQty] = useState("1"),
    [offline, setOffline] = useState(!navigator.onLine);
  const [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<Result | null>(null);
  if (!data)
    return (
      <Loading
        loading={loading}
        error={
          error ||
          "Connect once to load this branch's products before using offline capture."
        }
      />
    );
  const p = data.products.find(
      (x) => x.product_code === (code || data.products[0]?.product_code),
    ),
    n = Number(qty);
  const valid = !!p && Number.isSafeInteger(n) && n > 0,
    available = p
      ? Math.max(0, p.expected - reservedQuantity(outbox.rows, p.product_code))
      : 0;
  const tooMany = valid && n > available,
    closed = !!data.closing && data.closing.status !== "open";
  async function confirm() {
    if (!p || !valid || tooMany || closed || busy || outbox.error) return;
    setBusy(true);
    setMsg("");
    const sale = {
      local_ref: newReference(),
      product_code: p.product_code,
      product: p.name,
      quantity: n,
      unit_price: p.price,
      line_total: Math.round(n * p.price * 100) / 100,
      sold_at: captureTime(data!.date),
    };
    let saved = false;
    try {
      // Persist BEFORE transmitting: a lost response can safely retry this exact local reference.
      await enqueueSale(outbox.context, sale);
      saved = true;
      if (offline || !navigator.onLine) {
        setResult({ ...sale, status: "queued", txn_code: null });
        setQty("1");
        return;
      }
      const r = await api.post<Result>("/api/sales/sales", salePayload(sale));
      await removeLocalSale(outbox.context, sale.local_ref);
      setResult(r.data);
      setQty("1");
      reload();
    } catch (e) {
      const status = (e as { response?: { status: number } }).response?.status;
      if (saved && status && status >= 400 && status < 500 && status !== 401) {
        try {
          await removeLocalSale(outbox.context, sale.local_ref);
          setMsg(errMsg(e, "Sale rejected"));
        } catch (storageError) {
          setMsg((storageError as Error).message);
        }
      } else if (saved) {
        setResult({ ...sale, status: "queued", txn_code: null });
        setQty("1");
        setMsg(
          "The response could not be confirmed. This sale remains on this device and will be checked by its reference when you sync.",
        );
      } else setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-5">
      <PageHeader
        title="Record a sale"
        subtitle="Confirmed sales reduce branch stock; pending device sales post only after synchronization."
      />
      {(stale || error) && (
        <Notice tone="warn">
          {error} Offline totals are estimates until the server confirms its
          current price and stock.
        </Notice>
      )}
      {closed && (
        <Notice tone="warn">
          This business day's closing has been submitted. Further sales need
          owner review.
        </Notice>
      )}
      {outbox.error && <Notice tone="bad">{outbox.error}</Notice>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(19rem,1fr))] gap-5 max-md:grid-cols-1">
        <form
          className="rounded-lg border border-white/70 bg-white shadow-soft p-5 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          <h2 className="mb-3 text-lg font-semibold">Sale details</h2>
          <Field label="Product">
            <Select
              value={p?.product_code ?? ""}
              onChange={(e) => setCode(e.target.value)}
            >
              {data.products.map((x) => (
                <option key={x.product_code} value={x.product_code}>
                  {x.name} · {x.product_code}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Quantity"
            hint={`${available} available after this device's pending sales`}
          >
            <Input
              type="number"
              min={1}
              step={1}
              required
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          <Field label="Unit price">
            <Input readOnly value={p?.price.toFixed(2) ?? ""} />
          </Field>
          <label className="flex items-center gap-2">
            <Input
              type="checkbox"
              style={{ width: "auto" }}
              checked={offline}
              onChange={(e) => setOffline(e.target.checked)}
            />
            Keep on this device until connected
          </label>
          {tooMany && (
            <Notice tone="bad">
              Only {available} units are available after pending sales.
            </Notice>
          )}
          {msg && <Notice tone="warn">{msg}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!valid || tooMany || busy || closed || !!outbox.error}
              type="submit"
            >
              {busy ? "Saving…" : offline ? "Queue sale" : "Confirm sale"}
            </Button>
            <Button variant="secondary"
              type="button"
              onClick={() => go("workspace")}
            >
              Back to sales
            </Button>
          </div>
        </form>
        <section className="rounded-lg border border-white/70 bg-white shadow-soft p-5 grid content-start gap-5">
          <h2 className="mb-3 text-lg font-semibold">Transaction preview</h2>
          <p>{p?.name ?? "No active products"}</p>
          <strong className="text-2xl">
            {valid ? peso(n * p!.price) : "n/a"}
          </strong>
          <p className="text-mute">
            {offline || stale
              ? "Estimated total. No ledger change until confirmed."
              : valid
                ? `Branch stock movement: −${n} units`
                : "Enter a whole quantity."}
          </p>
        </section>
      </div>
      <ResultModal
        open={!!result}
        onClose={() => setResult(null)}
        title={
          result?.status === "queued"
            ? "Sale saved on this device"
            : "Sale recorded"
        }
        action={{
          label:
            result?.status === "queued"
              ? "View offline queue"
              : "View workspace",
          onClick: () =>
            go(result?.status === "queued" ? "queue" : "workspace"),
        }}
      >
        {result && (
          <>
            <p>{result.txn_code ?? result.local_ref}</p>
            <p>
              {result.product} × {result.quantity} · {peso(result.line_total)}
            </p>
            {result.stock_after !== undefined && (
              <p>
                Stock: {result.stock_before} → {result.stock_after}
              </p>
            )}
            {result.status === "queued" && (
              <Notice tone="warn">
                Keep this browser's site data. Synchronize before closing the
                day; this is not a confirmed server transaction yet.
              </Notice>
            )}
          </>
        )}
      </ResultModal>
    </div>
  );
}
