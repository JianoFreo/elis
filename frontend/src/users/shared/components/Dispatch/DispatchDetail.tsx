import { api } from "../../../../lib/axios";
import { Badge, Loading, Notice, PageHeader, StatCard, Stats, statusTone } from "../../../../components/ui";
import { useGo } from "../../../../lib/nav";
import { useApi } from "../../../../lib/useApi";
import { DISPATCH_STATUS, fmtDateTime, fmtTime } from "../../../../lib/format";
import type { Detail } from "./types";

export default function DispatchDetail({ code }: { code: string }) {
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
