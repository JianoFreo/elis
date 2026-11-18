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
    <div className="stack">
      <div className="card hero stack">
        <div>
          <h2>Welcome back, {first}!</h2>
          <p className="muted" style={{ margin: 0 }}>{fmtDate(data.date)} · All branches</p>
        </div>
        <div className="actions">
          <button onClick={() => go("discrepancies")}>Review discrepancies</button>
          <button className="secondary" onClick={() => go("alerts")}>Review alerts</button>
        </div>
      </div>

      <Stats>
        <StatCard label="Today's sales" value={peso(data.sales_today)} hint={`${data.items_today} items sold · all branches`} />
        <StatCard label="Available products" value={data.available_products} hint={`Across ${data.locations} locations`} />
        <StatCard label="Dispatches in transit" value={data.in_transit} hint="Awaiting branch confirmation" />
        <StatCard label="Needs your attention" value={data.open_flags + data.low_supplies} tone={data.open_flags + data.low_supplies ? "warn" : "ok"} hint={`${data.open_flags} stock flags · ${data.low_supplies} low supplies`} />
      </Stats>

      <div className="cols">
        <div className="card panel">
          <div className="row-between"><h2>Sales this week</h2><span className="muted">{peso(weekTotal)}</span></div>
          <BarChart data={data.week} />
        </div>
        <div className="card panel stack">
          <h2>Today's priorities</h2>
          {data.priorities.length === 0 && <Notice tone="ok">All clear. No open flags or low supplies.</Notice>}
          <ul className="list">
            {data.priorities.map((p) => (
              <li key={p.ref}>
                <span>{p.text}</span>
                <button className="link" onClick={() => (p.kind === "flag" ? go("discrepancies", p.ref) : go("alerts"))}>{p.kind === "flag" ? "Review" : "View"}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
