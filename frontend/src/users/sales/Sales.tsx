import Shell from "../../components/Shell";
import Workspace from "./pages/Workspace";
import RecordSale from "./pages/RecordSale";
import Queue from "./pages/Queue";
import Closing from "./pages/Closing";
import Summary from "./pages/Summary";
import Deliveries from "./pages/Deliveries";

export default function Sales() {
  return (
    <Shell
      title="Sales"
      items={[
        { key: "workspace", label: "Sales workspace", element: <Workspace /> },
        { key: "record", label: "Record a sale", element: <RecordSale /> },
        { key: "queue", label: "Offline queue", element: <Queue /> },
        { key: "closing", label: "Count & closing", element: <Closing /> },
        { key: "summary", label: "Daily summary", element: <Summary /> },
        { key: "deliveries", label: "Deliveries", element: <Deliveries /> },
      ]}
    />
  );
}
