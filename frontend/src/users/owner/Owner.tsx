import Shell from "../../components/Shell";
import Overview from "./pages/Overview";
import Users from "./pages/Users";
import Products from "./pages/Products";
import Materials from "./pages/Materials";
import Discrepancies from "./pages/Discrepancies";
import Audits from "./pages/Audits";
import Reports from "./pages/Reports";
import Inventory from "../shared/Inventory";
import Dispatch from "../shared/Dispatch";
import Supplies from "../shared/Supplies";
import Alerts from "../shared/Alerts";

export default function Owner() {
  return (
    <Shell
      title="Owner"
      items={[
        { key: "overview", label: "Overview", element: <Overview /> },
        { key: "inventory", label: "Product", element: <Inventory /> },
        { key: "dispatch", label: "Dispatch", element: <Dispatch /> },
        { key: "supplies", label: "Materials", element: <Supplies /> },
        { key: "discrepancies", label: "Discrepancies", element: <Discrepancies /> },
        { key: "audits", label: "Weekly audits", element: <Audits /> },
        { key: "reports", label: "Reports", element: <Reports /> },
        { key: "alerts", label: "Alerts", element: <Alerts url="/api/owner/alerts" /> },
        { key: "users", label: "Accounts", element: <Users /> },
        { key: "products", label: "Product list", element: <Products /> },
        { key: "materials", label: "Material list", element: <Materials /> },
      ]}
    />
  );
}
