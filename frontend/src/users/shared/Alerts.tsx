import { Badge, Loading, Notice, PageHeader, Progress } from "../../components/ui";
import { useGo } from "../../lib/nav";
import { useApi } from "../../lib/useApi";
import { num } from "../../lib/format";

interface Alerts {
  low: { material_code: string; name: string; unit: string; on_hand: number; threshold: number; supplier: string | null }[];
  near: { material_code: string; material: string; unit: string; opening: number; received: number; used: number; pct: number }[];
}

export default function Alerts({ url }: { url: string }) {
  const { data, error, loading } = useApi<Alerts>(url);
  const { go } = useGo();
  if (!data) return <Loading loading={loading} error={error} />;

  return (
    <div className="stack">
      <PageHeader title="A little attention goes a long way." subtitle="Low-stock notifications and supply usage warnings." actions={<button onClick={() => go("supplies")}>Go to supplies</button>} />
      {data.low.length === 0 && data.near.length === 0 && <Notice tone="ok">Nothing needs attention right now.</Notice>}

      <div className="cols">
        {data.low.map((m) => {
          const pct = m.threshold ? Math.min(100, (m.on_hand / (m.threshold * 4)) * 100) : 0;
          return (
            <div key={m.material_code} className="card panel stack">
              <div className="row-between"><h3>{m.name}</h3><Badge tone="warn">Below threshold</Badge></div>
              <strong style={{ fontSize: "1.4rem" }}>{num(m.on_hand)} {m.unit} remaining</strong>
              <Progress value={pct} tone="warn" />
              <p className="muted">Restock threshold {num(m.threshold)} {m.unit}{m.supplier ? ` · supplier ${m.supplier}` : ""}</p>
            </div>
          );
        })}
        {data.near.map((u) => (
          <div key={u.material_code} className="card panel stack">
            <div className="row-between"><h3>{u.material} · production supply</h3><Badge tone="bad">Near limit · {u.pct}%</Badge></div>
            <strong style={{ fontSize: "1.4rem" }}>{num(u.used)} / {num(u.opening + u.received)} {u.unit} used</strong>
            <Progress value={u.pct} tone="bad" />
            <p className="muted">{u.pct}% used · only {num(u.opening + u.received - u.used)} {u.unit} remains. Replenish before production.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
