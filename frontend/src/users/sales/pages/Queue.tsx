import { useState } from "react";
import { api } from "../../../lib/axios";
import { Button, DataTable, Notice, PageHeader, ResultModal } from "../../../components/ui";
import { errMsg, useApi } from "../../../lib/useApi";
import {
  failLocalSale,
  readLocalSales,
  removeLocalSale,
  salePayload,
} from "../../../lib/offlineSales";
import { useLocalSales } from "../../../lib/useSalesWorkspace";
import { fmtTime, peso } from "../../../lib/format";
interface Pending {
  local_ref: string;
  product: string;
  quantity: number;
  line_total: number;
  sold_at: string;
  error?: string;
  source?: string;
}
interface Sync {
  synced: string[];
  failed: { local_ref: string; reason: string }[];
  total: number;
}
export default function Queue() {
  const server = useApi<{ queue: Pending[] }>("/api/sales/queue"),
    local = useLocalSales();
  const [busy, setBusy] = useState(false),
    [msg, setMsg] = useState(""),
    [result, setResult] = useState<Sync | null>(null);
  const pending = new Map<string, Pending>();
  for (const r of server.data?.queue ?? [])
    pending.set(r.local_ref, { ...r, source: "Server pending" });
  for (const r of local.rows)
    pending.set(r.local_ref, { ...r, source: "This device" });
  const rows = [...pending.values()];
  async function sync() {
    setBusy(true);
    setMsg("");
    try {
      // Process the existing server queue first; old clients and seeded examples remain compatible.
      const out = (await api.post<Sync>("/api/sales/sync")).data;
      const device = readLocalSales(local.context);
      const serverRefs = new Set(
        server.data?.queue.map((s) => s.local_ref) ?? [],
      );
      const result: Sync = {
        synced: [...out.synced],
        failed: [...out.failed],
        total: out.total,
      };
      for (const sale of device) {
        const alreadyFailed = result.failed.find(
          (f) => f.local_ref === sale.local_ref,
        );
        if (alreadyFailed) {
          await failLocalSale(
            local.context,
            sale.local_ref,
            alreadyFailed.reason,
          );
          continue;
        }
        if (!serverRefs.has(sale.local_ref)) result.total++;
        try {
          const r = await api.post("/api/sales/sales", salePayload(sale));
          if (r.data.status !== "synced")
            throw new Error(
              "The server has not confirmed this transaction yet",
            );
          await removeLocalSale(local.context, sale.local_ref);
          if (!result.synced.includes(r.data.txn_code))
            result.synced.push(r.data.txn_code);
        } catch (e) {
          const reason = errMsg(
            e,
            (e as Error).message ||
              "Connection interrupted; the same reference will be checked on retry",
          );
          await failLocalSale(local.context, sale.local_ref, reason);
          result.failed.push({ local_ref: sale.local_ref, reason });
        }
      }
      setResult(result);
      await server.reload();
      local.reload();
    } catch (e) {
      setMsg(
        errMsg(
          e,
          (e as Error).message ||
            "Cannot reach the server. Pending device sales have been kept.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-5">
      <PageHeader
        title="Offline transaction queue"
        subtitle="Pending device records remain separate until the server confirms each unique reference."
        actions={
          <Button
            disabled={busy || !!local.error || (!rows.length && !server.error)}
            onClick={sync}
          >
            {busy ? "Syncing…" : "Sync queued transactions"}
          </Button>
        }
      />
      {local.error && <Notice tone="bad">{local.error}</Notice>}
      {server.error && (
        <Notice tone="warn">
          Server queue unavailable. This device's saved records are still shown.
          Connect and retry synchronization.
        </Notice>
      )}
      {msg && <Notice tone="bad">{msg}</Notice>}
      <Notice tone={rows.length ? "info" : "ok"}>
        {rows.length
          ? `${rows.length} pending reference(s). Keep this browser's site data until every sale is confirmed.`
          : server.error
            ? "No device records; server queue has not been checked."
            : "You're all caught up. No pending transactions."}
      </Notice>
      <DataTable
        rows={rows}
        empty={
          server.loading ? "Checking server queue…" : "No pending transactions."
        }
        cols={[
          { header: "Local reference", render: (r) => r.local_ref },
          { header: "Time", render: (r) => fmtTime(r.sold_at) },
          { header: "Product", render: (r) => r.product },
          { header: "Qty", render: (r) => r.quantity, align: "right" },
          {
            header: "Estimated total",
            render: (r) => peso(r.line_total),
            align: "right",
          },
          {
            header: "Location / status",
            render: (r) => (
              <span>
                {r.source}
                {r.error && (
                  <small className="block text-danger">{r.error}</small>
                )}
              </span>
            ),
          },
        ]}
      />
      <ResultModal
        open={!!result}
        onClose={() => setResult(null)}
        title={
          result?.failed.length ? "Partly synced" : "You're all caught up."
        }
      >
        {result && (
          <>
            <Notice tone={result.failed.length ? "warn" : "ok"}>
              {result.synced.length} of {result.total} reference checks
              confirmed. Previously confirmed references are not posted again.
            </Notice>
            {result.failed.map((f) => (
              <p key={f.local_ref} className="text-danger">
                {f.local_ref}: {f.reason}. Kept pending.
              </p>
            ))}
          </>
        )}
      </ResultModal>
    </div>
  );
}
