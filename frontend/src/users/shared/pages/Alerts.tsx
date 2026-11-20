import { Badge, Button, Loading, Notice, PageHeader, Progress } from "../../../components/ui";
import { useGo } from "../../../lib/nav";
import { useApi } from "../../../lib/useApi";
import { num } from "../../../lib/format";

interface Alerts {
  low: { material_code: string; name: string; unit: string; on_hand: number; threshold: number; supplier: string | null }[];
  near: { material_code: string; material: string; unit: string; opening: number; received: number; used: number; pct: number }[];
}

export default function Alerts({ url }: { url: string }) {
  const { data, error, loading } = useApi<Alerts>(url);
  const { go } = useGo();
  if (!data) return <Loading loading={loading} error={error} />;

  return (
    <div className="grid gap-5">
      <PageHeader title="A little attention goes a long way." subtitle="Low-stock notifications and supply usage warnings." actions={<Button onClick={() => go("supplies")}>Go to supplies</Button>} />
      {data.low.length === 0 && data.near.length === 0 && <Notice tone="ok">Nothing needs attention right now.</Notice>}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(19rem,1fr))] gap-5 max-md:grid-cols-1">
        {data.low.map((m) => {
          const pct = m.threshold ? Math.min(100, (m.on_hand / (m.threshold * 4)) * 100) : 0;
          return (
            <div key={m.material_code} className="rounded-lg border border-white/70 bg-white shadow-soft p-5 max-md:p-4 grid gap-5">
              <div className="flex flex-wrap items-center justify-between gap-4"><h3 className="mb-2 text-base font-semibold">{m.name}</h3><Badge tone="warn">Below threshold</Badge></div>
              <strong style={{ fontSize: "1.4rem" }}>{num(m.on_hand)} {m.unit} remaining</strong>
              <Progress value={pct} tone="warn" />
              <p className="text-mute">Restock threshold {num(m.threshold)} {m.unit}{m.supplier ? ` · supplier ${m.supplier}` : ""}</p>
            </div>
          );
        })}
        {data.near.map((u) => (
          <div key={u.material_code} className="rounded-lg border border-white/70 bg-white shadow-soft p-5 max-md:p-4 grid gap-5">
            <div className="flex flex-wrap items-center justify-between gap-4"><h3 className="mb-2 text-base font-semibold">{u.material} · production supply</h3><Badge tone="bad">Near limit · {u.pct}%</Badge></div>
            <strong style={{ fontSize: "1.4rem" }}>{num(u.used)} / {num(u.opening + u.received)} {u.unit} used</strong>
            <Progress value={u.pct} tone="bad" />
            <p className="text-mute">{u.pct}% used · only {num(u.opening + u.received - u.used)} {u.unit} remains. Replenish before production.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
