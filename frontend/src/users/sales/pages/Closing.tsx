import { useEffect, useState } from "react";
import { api } from "../../../lib/axios";
import { Badge, DataTable, Field, Loading, Notice, PageHeader, ResultModal, Steps } from "../../../components/ui";
import { useGo } from "../../../lib/nav";
import { currentUser, errMsg, useApi } from "../../../lib/useApi";
import { signed } from "../../../lib/format";

interface Count {
  date: string; closing: { close_code: string; status: string; note: string | null } | null;
  products: { product_code: string; name: string; expected: number; sold: number; opening_received: number; counted: number | null }[];
}

export default function Closing() {
  const { data, error, loading, reload } = useApi<Count>("/api/sales/closing/count");
  const { go } = useGo();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [step, setStep] = useState<2 | 3>(2);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<{ close_code: string; flagged: number } | null>(null);
  const me = currentUser();

  useEffect(() => {
    if (data) setCounts(Object.fromEntries(data.products.map((p) => [p.product_code, p.counted === null ? "" : String(p.counted)])));
  }, [data]);

  if (!data) return <Loading loading={loading} error={error} />;
  const submitted = !!data.closing && data.closing.status !== "open";
  const rows = data.products.map((p) => {
    const raw = counts[p.product_code] ?? "";
    const physical = raw === "" ? null : Number(raw);
    return { ...p, physical, variance: physical === null ? null : physical - p.expected };
  });
  const allCounted = rows.every((r) => r.physical !== null && Number.isInteger(r.physical) && r.physical >= 0);
  const flagged = rows.filter((r) => r.variance !== 0 && r.variance !== null);

  async function submit() {
    setBusy(true); setMsg("");
    try {
      const r = await api.post("/api/sales/closing", { counts: rows.map((x) => ({ product_code: x.product_code, physical: x.physical })), note });
      setDone(r.data); reload();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  }

  if (submitted)
    return (
      <div className="grid gap-5">
        <PageHeader title="Daily closing" subtitle={`${data.closing!.close_code} · submitted for owner review`} />
        <Notice tone="ok">Your shift has been sent for owner review. Only an approved adjustment changes the reconciled ledger.</Notice>
        <DataTable
          rows={rows}
          cols={[
            { header: "Product", render: (r) => r.name },
            { header: "Expected", render: (r) => r.expected, align: "right" },
            { header: "Physical", render: (r) => r.counted ?? "-", align: "right" },
            { header: "Variance", render: (r) => (r.counted === null ? "-" : signed(r.counted - r.expected)), align: "right" },
          ]}
        />
        {data.closing!.note && <p className="text-mute">Closing note: “{data.closing!.note}”</p>}
        <div><button onClick={() => go("summary")}>View summary</button></div>
      </div>
    );

  return (
    <div className="grid gap-5">
      <PageHeader
        title={step === 2 ? "Count what's on hand" : "Review your daily closing"}
        subtitle={step === 2 ? "Enter physical closing counts. Expected = opening + received + adjustments − sales − outgoing." : "Confirm the count and submit the shift for owner review."}
      />
      <Steps current={step} steps={["Review sales", "Count stock", "Submit closing"]} />

      {step === 2 && (
        <div className="rounded-md border border-line bg-white  p-5 max-md:p-4 grid gap-4">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 max-md:grid-cols-1">
            {rows.map((r) => (
              <Field key={r.product_code} label={`${r.name} · expected ${r.expected}`}>
                <input type="number" min={0} step={1} value={counts[r.product_code] ?? ""} onChange={(e) => setCounts({ ...counts, [r.product_code]: e.target.value })} />
              </Field>
            ))}
          </div>
          <Field label="Counted by"><input value={`${me.full_name} · Sales Staff`} readOnly /></Field>
          {allCounted && flagged.length > 0 && (
            <Notice tone="warn">{flagged.map((f) => `${f.name} is ${Math.abs(f.variance!)} unit(s) ${f.variance! < 0 ? "below" : "above"} expected`).join("; ")}. Submitting creates a discrepancy flag.</Notice>
          )}
          <div className="flex flex-wrap gap-2">
            <button disabled={!allCounted} onClick={() => setStep(3)}>Compare &amp; review closing</button>
            <button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => go("summary")}>Back to summary</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Badge tone={flagged.length ? "warn" : "ok"}>{flagged.length ? "Flagged" : "Matched"}</Badge>
            <button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => setStep(2)}>Edit count</button>
          </div>
          <DataTable
            rows={rows}
            cols={[
              { header: "Product", render: (r) => r.name },
              { header: "Expected", render: (r) => r.expected, align: "right" },
              { header: "Physical", render: (r) => r.physical, align: "right" },
              { header: "Variance", render: (r) => <strong>{signed(r.variance!)}</strong>, align: "right" },
            ]}
          />
          <Field label="Reason / supporting note" hint={flagged.length ? "Required because the count differs from expected." : "Optional."}>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Two units damaged during display." />
          </Field>
          <Notice tone="muted">A variance is a flag for review. It is not an approved inventory adjustment.</Notice>
          {msg && <p className="m-0 text-danger">{msg}</p>}
          <div><button disabled={busy || (flagged.length > 0 && !note.trim())} onClick={submit}>{busy ? "Submitting..." : "Submit daily closing"}</button></div>
        </div>
      )}

      <ResultModal open={!!done} onClose={() => setDone(null)} title="Closing submitted" action={{ label: "View summary", onClick: () => go("summary") }}>
        {done && <><Notice tone="ok">Your shift was sent for owner review ({done.close_code}).</Notice>
          <p className="text-mute">{done.flagged ? `${done.flagged} count variance flagged.` : "No variances."} Only an approved adjustment changes the reconciled ledger.</p></>}
      </ResultModal>
    </div>
  );
}
