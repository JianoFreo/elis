import { BarChart, Loading, Notice, PageHeader, Badge } from "../../../components/ui";
import { useGo } from "../../../lib/nav";
import { currentUser, useApi } from "../../../lib/useApi";
import { fmtDate, peso } from "../../../lib/format";

interface Overview {
  date: string; sales_today: number; items_today: number; available_products: number; locations: number; in_transit: number;
  open_flags: number; low_supplies: number; week: { day: string; total: number }[];
  priorities: { kind: string; ref: string; text: string }[];
}

const CARD = "rounded-md border border-line bg-white p-5 max-md:p-4";
const LINK = "bg-transparent px-1.5 py-1 font-semibold text-pink-dark shadow-none hover:bg-pink-soft";

/** Today against yesterday, stated in words as well as a sign so colour is never the only cue. */
function trend(today: number, prev: number | undefined): string {
  if (prev === undefined || prev <= 0) return "No sales yesterday to compare";
  const pct = Math.round(((today - prev) / prev) * 100);
  if (pct === 0) return "Level with yesterday";
  return `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}% on yesterday (${pct > 0 ? "+" : "-"}${peso(Math.abs(today - prev))})`;
}

export default function Overview() {
  const { data, error, loading } = useApi<Overview>("/api/owner/overview");
  const { go } = useGo();
  if (!data) return <Loading loading={loading} error={error} />;
  const first = currentUser().full_name.split(" ")[0];
  const weekTotal = data.week.reduce((s, d) => s + d.total, 0);
  const attention = data.open_flags + data.low_supplies;
  const prev = data.week.length > 1 ? data.week[data.week.length - 2].total : undefined;
  const chartLabel = `Sales this week, ${peso(weekTotal)} in total. ${data.week.map((d) => `${d.day}: ${peso(d.total)}`).join(", ")}`;

  return (
    <div className="grid gap-5">
      <PageHeader
        title={`Welcome back, ${first}`}
        subtitle={`${fmtDate(data.date)} · All branches`}
        actions={<>
          <button onClick={() => go("discrepancies")}>Review discrepancies</button>
          <button className="border border-line bg-white text-ink shadow-none hover:bg-surface-alt" onClick={() => go("alerts")}>Review alerts</button>
        </>}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Band 1: the lead number and its own chart, with the quiet figures beside it */}
        <section className={`${CARD} lg:col-span-8`} aria-labelledby="ov-sales">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div className="grid gap-1">
              <h2 id="ov-sales" className="m-0 text-xs font-semibold uppercase tracking-wider text-mute">Today's sales</h2>
              <strong className="text-5xl font-semibold leading-none tracking-tight tabular-nums max-md:text-4xl">{peso(data.sales_today)}</strong>
              <span className="text-sm text-body">{trend(data.sales_today, prev)}</span>
            </div>
            <div className="grid gap-1 text-right text-sm text-mute max-md:text-left">
              <span>{data.items_today} items sold today</span>
              <span>{peso(weekTotal)} this week</span>
            </div>
          </div>
          <BarChart data={data.week} label={chartLabel} />
        </section>

        <section className={`${CARD} grid content-between gap-5 lg:col-span-4`} aria-label="Stock and dispatch">
          <div className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-mute">Dispatches in transit</span>
            <strong className="text-3xl font-semibold tabular-nums">{data.in_transit}</strong>
            <span className="text-xs text-mute">Awaiting branch confirmation</span>
          </div>
          <div className="grid gap-1 border-t border-line pt-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-mute">Available products</span>
            <strong className="text-3xl font-semibold tabular-nums">{data.available_products}</strong>
            <span className="text-xs text-mute">Across {data.locations} locations</span>
          </div>
        </section>

        {/* Band 2: what needs a decision */}
        <section className={`${CARD} grid content-start gap-4 lg:col-span-5`} aria-labelledby="ov-attn">
          <h2 id="ov-attn" className="m-0">Needs your attention</h2>
          <div className="flex items-center gap-3">
            <strong className={`text-3xl font-semibold tabular-nums ${attention ? "text-warn" : "text-ok"}`}>{attention}</strong>
            <Badge tone={attention ? "warn" : "ok"}>{attention ? "Action needed" : "All clear"}</Badge>
          </div>
          <dl className="m-0 grid gap-2 text-sm">
            <div className="flex justify-between gap-4 border-t border-line pt-2"><dt className="text-body">Stock flags</dt><dd className="m-0 font-semibold tabular-nums">{data.open_flags}</dd></div>
            <div className="flex justify-between gap-4 border-t border-line pt-2"><dt className="text-body">Low supplies</dt><dd className="m-0 font-semibold tabular-nums">{data.low_supplies}</dd></div>
          </dl>
        </section>

        <section className={`${CARD} grid content-start gap-4 lg:col-span-7`} aria-labelledby="ov-prio">
          <h2 id="ov-prio" className="m-0">Today's priorities</h2>
          {data.priorities.length === 0 && <Notice tone="ok">All clear. No open flags or low supplies.</Notice>}
          <ul className="m-0 grid list-none gap-2.5 p-0 [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:rounded-md [&>li]:border [&>li]:border-line [&>li]:bg-white [&>li]:px-3.5 [&>li]:py-2.5 max-md:[&>li]:flex-wrap">
            {data.priorities.map((p) => (
              <li key={p.ref}>
                <span>{p.text}</span>
                <button className={LINK} onClick={() => (p.kind === "flag" ? go("discrepancies", p.ref) : go("alerts"))}>{p.kind === "flag" ? "Review" : "View"}</button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Band 3: the page ends on purpose */}
      <p className="m-0 border-t border-line pt-4 text-xs text-mute">Figures cover all branches as of {fmtDate(data.date)}.</p>
    </div>
  );
}
