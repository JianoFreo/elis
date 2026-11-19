import {
  Badge,
  DataTable,
  Loading,
  Notice,
  PageHeader,
  Progress,
  StatCard,
  Stats,
  Steps,
  statusTone,
} from "../../../components/ui";
import { useGo } from "../../../lib/nav";
import {
  useLocalSales,
  useSalesWorkspace,
} from "../../../lib/useSalesWorkspace";
import { fmtDate, fmtTime, peso } from "../../../lib/format";

interface Workspace {
  branch: string;
  date: string;
  shift: string;
  sales_total: number;
  items_sold: number;
  queued: number;
  expected_on_hand: number;
  closing: { close_code: string; status: string } | null;
  step: number;
  recent: {
    txn_code: string | null;
    local_ref: string | null;
    sold_at: string;
    product: string;
    quantity: number;
    line_total: number;
    status: string;
  }[];
}

export default function Workspace() {
  const { data, error, loading, stale } = useSalesWorkspace();
  const local = useLocalSales();
  const { go } = useGo();
  if (!data) return <Loading loading={loading} error={error} />;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Sales workspace"
        subtitle={`${data.branch} · ${data.shift} · ${fmtDate(data.date)}`}
        actions={
          <>
            <button onClick={() => go("record")}>Record a sale</button>
            <button
              className="border border-line bg-white text-ink shadow-none hover:bg-surface-alt"
              onClick={() => go("queue")}
            >
              Offline queue
            </button>
            <button
              className="border border-line bg-white text-ink shadow-none hover:bg-surface-alt"
              onClick={() => go("summary")}
            >
              Daily summary
            </button>
          </>
        }
      />
      {stale && (
        <Notice tone="warn">
          Offline workspace copy: synchronize and refresh before counting or
          closing.
        </Notice>
      )}
      {local.error && <Notice tone="bad">{local.error}</Notice>}
      <Stats>
        <StatCard
          label="Shift sales"
          value={peso(data.sales_total)}
          hint={`${data.items_sold} items sold`}
        />
        <StatCard
          label="Queued offline"
          value={
            data.queued +
            local.rows.filter(
              (r) =>
                !data.recent.some(
                  (s) => s.local_ref === r.local_ref && s.status === "queued",
                ),
            ).length
          }
          hint="Awaiting a connection"
          tone={data.queued ? "warn" : undefined}
        />
        <StatCard
          label="Expected on hand"
          value={data.expected_on_hand}
          hint="Count at the end of your shift"
        />
      </Stats>

      <div className="rounded-md border border-line bg-white  p-5 max-md:p-4 grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2>Shift closing checklist</h2>
          <Badge tone={data.step === 3 ? "ok" : "info"}>
            {data.step === 3 && data.closing
              ? `Closing ${data.closing.status}`
              : `Step ${data.step} of 3`}
          </Badge>
        </div>
        <Steps
          current={data.step}
          steps={["Review sales", "Count stock", "Submit closing"]}
        />
        <Progress
          value={(data.step / 3) * 100}
          tone={data.step === 3 ? "ok" : "info"}
        />
        <div>
          <button onClick={() => go("closing")}>
            {data.closing && data.closing.status !== "open"
              ? "View closing"
              : "Continue to stock count"}
          </button>
        </div>
      </div>

      <div>
        <h2>Recent transactions</h2>
        <DataTable
          rows={data.recent}
          empty="No sales recorded yet today."
          cols={[
            { header: "Time", render: (r) => fmtTime(r.sold_at) },
            { header: "Reference", render: (r) => r.txn_code ?? r.local_ref },
            { header: "Product", render: (r) => r.product },
            { header: "Qty", render: (r) => r.quantity, align: "right" },
            {
              header: "Line total",
              render: (r) => peso(r.line_total),
              align: "right",
            },
            {
              header: "Status",
              render: (r) => (
                <Badge tone={statusTone(r.status)}>
                  {r.status === "queued" ? "Queued" : "Synced"}
                </Badge>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
