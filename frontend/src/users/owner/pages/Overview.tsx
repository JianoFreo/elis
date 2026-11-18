import { BarChart, Loading, Notice, PageHeader, StatCard, Stats } from "../../../components/ui";
import { useGo } from "../../../lib/nav";
import { currentUser, useApi } from "../../../lib/useApi";
import { fmtDate, peso } from "../../../lib/format";

interface Overview {
  date: string; sales_today: number; items_today: number; available_products: number; locations: number; in_transit: number;
  open_flags: number; low_supplies: number; week: { day: string; total: number }[];
  priorities: { kind: string; ref: string; text: string }[];
}

export default function Overview() {
  const { data, error, loading } = useApi<Overview>("/api/owner/overview");
  const { go } = useGo();
  if (!data) return <Loading loading={loading} error={error} />;
  const first = currentUser().full_name.split(" ")[0];
  const weekTotal = data.week.reduce((s, d) => s + d.total, 0);

  return (
    <div className="grid gap-5">
      <div className="rounded-md border border-line bg-white  border-pink/20 bg-pink-soft p-6 [&_h2]:text-2xl grid gap-5">
        <div>
          <h2>Welcome back, {first}!</h2>
          <p className="text-mute" style={{ margin: 0 }}>{fmtDate(data.date)} · All branches</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => go("discrepancies")}>Review discrepancies</button>
          <button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => go("alerts")}>Review alerts</button>
        </div>
      </div>

      <Stats>
        <StatCard label="Today's sales" value={peso(data.sales_today)} hint={`${data.items_today} items sold · all branches`} />
        <StatCard label="Available products" value={data.available_products} hint={`Across ${data.locations} locations`} />
        <StatCard label="Dispatches in transit" value={data.in_transit} hint="Awaiting branch confirmation" />
        <StatCard label="Needs your attention" value={data.open_flags + data.low_supplies} tone={data.open_flags + data.low_supplies ? "warn" : "ok"} hint={`${data.open_flags} stock flags · ${data.low_supplies} low supplies`} />
      </Stats>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5 max-md:grid-cols-1">
        <div className="rounded-md border border-line bg-white  p-5 max-md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-4"><h2>Sales this week</h2><span className="text-mute">{peso(weekTotal)}</span></div>
          <BarChart data={data.week} />
        </div>
        <div className="rounded-md border border-line bg-white  p-5 max-md:p-4 grid gap-5">
          <h2>Today's priorities</h2>
          {data.priorities.length === 0 && <Notice tone="ok">All clear. No open flags or low supplies.</Notice>}
          <ul className="m-0 grid list-none gap-2.5 p-0 [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:rounded-md [&>li]:border [&>li]:border-line [&>li]:bg-white [&>li]:px-3.5 [&>li]:py-2.5 max-md:[&>li]:flex-wrap">
            {data.priorities.map((p) => (
              <li key={p.ref}>
                <span>{p.text}</span>
                <button className="bg-transparent px-1.5 py-1 font-semibold text-pink-dark shadow-none hover:bg-pink-soft" onClick={() => (p.kind === "flag" ? go("discrepancies", p.ref) : go("alerts"))}>{p.kind === "flag" ? "Review" : "View"}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
