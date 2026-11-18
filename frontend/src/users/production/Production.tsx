import Shell from "../../components/Shell";
import Inventory from "../shared/Inventory";
import Dispatch from "../shared/Dispatch";
import Supplies from "../shared/Supplies";
import Alerts from "../shared/Alerts";

// Production head: inventory, dispatch, supplies. Production staff: supplies logging only.
export default function Production() {
  const role = sessionStorage.getItem("role");
  const alerts = { key: "alerts", label: "Alerts", element: <Alerts url="/api/production/supplies/alerts" /> };
  const supplies = { key: "supplies", label: "Supplies & usage", element: <Supplies /> };

  if (role === "production-staff") return <Shell title="Production" items={[supplies, alerts]} />;
  return (
    <Shell
      title="Production"
      items={[
        { key: "inventory", label: "Inventory & products", element: <Inventory /> },
        { key: "dispatch", label: "Dispatch & receipts", element: <Dispatch /> },
        supplies,
        alerts,
      ]}
    />
  );
}
