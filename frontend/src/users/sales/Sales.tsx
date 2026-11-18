import Shell from "../../components/Shell";
import Overview from "./pages/Overview";

export default function Sales() {
  return <Shell title="Sales" items={[{ key: "overview", label: "Overview", element: <Overview /> }]} />;
}
