import { useState } from "react";
import { api } from "../../../lib/axios";
import { DataTable, Loading, Notice, PageHeader, Progress, ResultModal } from "../../../components/ui";
import { errMsg, useApi } from "../../../lib/useApi";
import { fmtTime, peso } from "../../../lib/format";

interface Queue { queue: { local_ref: string; product: string; quantity: number; line_total: number; sold_at: string }[] }
interface Sync { synced: string[]; failed: { local_ref: string; reason: string }[]; total: number }

export default function Queue() {
  const { data, error, loading, reload } = useApi<Queue>("/api/sales/queue");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<Sync | null>(null);
  if (!data) return <Loading loading={loading} error={error} />;

  async function sync() {
    setBusy(true); setMsg("");
    try { setResult((await api.post("/api/sales/sync")).data); reload(); }
    catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Offline transaction queue"
        subtitle="Local-device sales waiting to sync. Pending records stay separate until synchronization succeeds."
        actions={<button disabled={busy || data.queue.length === 0} onClick={sync}>{busy ? "Syncing..." : "Sync queued transactions"}</button>}
      />
      <div className="rounded-xl border border-line bg-white shadow-sm p-5 max-md:p-4 grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4"><strong>Queue synchronization</strong><span className="text-mute">{data.queue.length} pending</span></div>
        <Progress value={data.queue.length === 0 ? 100 : 0} tone={data.queue.length === 0 ? "ok" : "info"} />
        {data.queue.length === 0
          ? <Notice tone="ok">You're all caught up. Nothing is waiting to sync.</Notice>
          : <Notice tone="info">Confirm a connection before synchronizing. Each local reference posts once, so nothing is counted twice.</Notice>}
      </div>
      {msg && <p className="m-0 text-danger">{msg}</p>}
      <DataTable
        rows={data.queue}
        empty="No pending transactions."
        cols={[
          { header: "Local reference", render: (r) => r.local_ref },
          { header: "Time", render: (r) => fmtTime(r.sold_at) },
          { header: "Product", render: (r) => r.product },
          { header: "Qty", render: (r) => r.quantity, align: "right" },
          { header: "Total", render: (r) => peso(r.line_total), align: "right" },
        ]}
      />
      <ResultModal open={!!result} onClose={() => setResult(null)} title={result && result.failed.length ? "Partly synced" : "You're all caught up."}>
        {result && (
          <>
            <Notice tone={result.failed.length ? "warn" : "ok"}>{result.synced.length} of {result.total} synchronized.</Notice>
            {result.synced.length > 0 && <p>Confirmed as {result.synced.join(", ")}. Local references are matched to confirmed transactions to prevent duplicate posting.</p>}
            {result.failed.map((f) => <p key={f.local_ref} className="m-0 text-danger">{f.local_ref}: {f.reason}. It stays in the queue.</p>)}
          </>
        )}
      </ResultModal>
    </div>
  );
}
