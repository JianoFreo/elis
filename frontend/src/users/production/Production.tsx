import Shell from "../../components/Shell";
import Inventory from "../shared/pages/Inventory";
import Dispatch from "../shared/pages/Dispatch";
import Supplies from "../shared/pages/Supplies";
import Alerts from "../shared/pages/Alerts";

// Production head: inventory, dispatch, supplies. Production staff: supplies logging only.
export default function Production() {
  const role = sessionStorage.getItem("role");
  const alerts = { key: "alerts", label: "Alerts", element: <Alerts url="/api/production/supplies/alerts" /> };
  const supplies = { key: "supplies", label: "Materials", element: <Supplies /> };

  if (role === "production-staff") return <Shell title="Production" items={[supplies, alerts]} />;
  return (
    <Shell
      title="Production"
      items={[
        { key: "inventory", label: "Product", element: <Inventory /> },
        { key: "dispatch", label: "Dispatch & receipts", element: <Dispatch /> },
        supplies,
        alerts,
      ]}
    />
  );
}
