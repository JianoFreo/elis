import { Badge, DataTable, Loading, PageHeader, StatCard, Stats, statusTone } from "../../../components/ui";
import { useGo } from "../../../lib/nav";
import { useApi } from "../../../lib/useApi";
import { fmtDate, peso, signed } from "../../../lib/format";

interface Summary {
  date: string; branch: string; sales_total: number; items_sold: number; open_flags: number; variance: number;
  closing: { close_code: string; status: string } | null;
  products: { product_code: string; name: string; opening_received: number; sold: number; expected: number; counted: number | null }[];
}

export default function Summary() {
  const { data, error, loading } = useApi<Summary>("/api/sales/summary");
  const { go } = useGo();
  if (!data) return <Loading loading={loading} error={error} />;
  const status = !data.closing ? "Closing not submitted" : data.closing.status === "confirmed" ? "Confirmed" : "Submitted · owner review";

  return (
    <div className="stack">
      <PageHeader
        title="Daily sales & stock summary"
        subtitle={`${fmtDate(data.date)} · ${data.branch}`}
        actions={<><button onClick={() => go("closing")}>{data.closing ? "Review closing" : "Enter physical count"}</button></>}
      />
      <Stats>
        <StatCard label="Sales total" value={peso(data.sales_total)} hint={`${data.items_sold} items sold`} />
        <StatCard label="Open discrepancies" value={data.open_flags} tone={data.open_flags ? "warn" : "ok"} hint="Owner review required" />
        <StatCard label="Shift status" value={<Badge tone={statusTone(status)}>{status}</Badge>} />
        <StatCard label="Count variance" value={data.variance === 0 ? "0" : signed(data.variance)} tone={data.variance ? "warn" : undefined} />
      </Stats>
      <DataTable
        rows={data.products}
        cols={[
          { header: "Product", render: (p) => p.name },
          { header: "Opening + received", render: (p) => p.opening_received, align: "right" },
          { header: "Sold", render: (p) => p.sold, align: "right" },
          { header: "Expected", render: (p) => p.expected, align: "right" },
          { header: "Counted", render: (p) => p.counted ?? "-", align: "right" },
        ]}
      />
    </div>
  );
}
