import { useState } from "react";
import { Badge, Button, DataTable, Field, Input, Loading, Modal, PageHeader, Select, StatCard, Stats } from "../../../components/ui";
import { useGo } from "../../../lib/nav";
import { downloadCsv, useApi } from "../../../lib/useApi";
import { fmtDate } from "../../../lib/format";

type Kind = "daily" | "stock" | "dispatch" | "supply";
interface Report { title: string; date: string; summary: Record<string, unknown>; rows: Record<string, unknown>[] }

const CARDS: { kind: Kind; title: string; text: string }[] = [
  { kind: "daily", title: "Daily sales & closing", text: "Sales quantity, totals, expected stock, physical counts and closing status." },
  { kind: "stock", title: "Stock & reconciliation", text: "Product quantities, batch best-before dates and restock exceptions." },
  { kind: "dispatch", title: "Dispatch status", text: "Dispatched versus received quantities and unresolved delivery alerts." },
  { kind: "supply", title: "Supply usage & restock", text: "Material opening, received, used and remaining against thresholds." },
];
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
const label = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export default function Reports() {
  const [scope, setScope] = useState<{ kind: Kind; date: string; branch_id: string } | null>(null);
  const [open, setOpen] = useState<Kind | null>(null);
  const [date, setDate] = useState("");
  const [branch, setBranch] = useState("");
  const branches = useApi<{ branches: { id: number; name: string; kind: string }[] }>("/api/shared/branches");
  const { go } = useGo();
  const selling = branches.data?.branches.filter((b) => b.kind === "branch") ?? [];

  if (scope) return <ReportView scope={scope} back={() => setScope(null)} />;

  return (
    <div className="grid gap-5">
      <PageHeader title="Reports, with the full picture." subtitle="Owner reporting workspace" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(19rem,1fr))] gap-5 max-md:grid-cols-1">
        {CARDS.map((c) => (
          <div key={c.kind} className="rounded-lg border border-white/70 bg-white shadow-soft p-5 max-md:p-4 grid gap-5">
            <h2 className="mb-3 text-lg font-semibold">{c.title}</h2>
            <p className="text-mute">{c.text}</p>
            <div><Button onClick={() => { setOpen(c.kind); setDate(today()); setBranch(String(selling[0]?.id ?? "")); }}>Open report</Button></div>
          </div>
        ))}
        <div className="rounded-lg border border-white/70 bg-white shadow-soft p-5 max-md:p-4 grid gap-5">
          <h2 className="mb-3 text-lg font-semibold">Weekly audit</h2>
          <p className="text-mute">Confirmed summaries, branch stock status, exceptions and owner sign-off.</p>
          <div><Button onClick={() => go("audits")}>Open weekly audit</Button></div>
        </div>
      </div>

      <Modal
        open={!!open} onClose={() => setOpen(null)} title="Choose report scope"
        footer={<><Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
          <Button disabled={!date || (open === "daily" && !branch)} onClick={() => { setScope({ kind: open!, date, branch_id: branch }); setOpen(null); }}>View report</Button></>}
      >
        <p className="text-mute">Select the daily view for the report you want to inspect.</p>
        <Field label="Report date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {open === "daily" && (
          <Field label="Branch"><Select value={branch} onChange={(e) => setBranch(e.target.value)}>{selling.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
        )}
      </Modal>
    </div>
  );
}

function ReportView({ scope, back }: { scope: { kind: Kind; date: string; branch_id: string }; back: () => void }) {
  const params = { date: scope.date, branch_id: scope.kind === "daily" ? scope.branch_id : undefined };
  const { data, error, loading } = useApi<Report>(`/api/owner/reports/${scope.kind}`, params);
  const [busy, setBusy] = useState(false);
  if (!data) return <div className="grid gap-5"><Button variant="secondary" onClick={back}>Back to reports</Button><Loading loading={loading} error={error} /></div>;
  const cols = data.rows[0] ? Object.keys(data.rows[0]) : [];

  return (
    <div className="grid gap-5">
      <PageHeader
        title={data.title}
        subtitle={fmtDate(data.date)}
        actions={<>
          <Button disabled={busy} onClick={async () => { setBusy(true); try { await downloadCsv(`/api/owner/reports/${scope.kind}`, params, `${scope.kind}-${data.date}`); } finally { setBusy(false); } }}>Export CSV</Button>
          <Button variant="secondary" onClick={back}>Back to reports</Button>
        </>}
      />
      <Stats>
        {Object.entries(data.summary).map(([k, v]) => (
          <StatCard key={k} label={label(k)} value={typeof v === "number" ? v.toLocaleString() : String(v ?? "-")} />
        ))}
      </Stats>
      <DataTable
        rows={data.rows}
        empty="No records for this date."
        cols={cols.map((c) => ({
          header: c,
          render: (r: Record<string, unknown>) => (c === "Status" ? <Badge tone={/low|review|flag/i.test(String(r[c])) ? "warn" : "ok"}>{String(r[c])}</Badge> : String(r[c] ?? "")),
        }))}
      />
    </div>
  );
}
