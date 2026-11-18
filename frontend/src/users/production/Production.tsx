import Shell from "../../components/Shell";
import Overview from "./pages/Overview";

export default function Production() {
  return <Shell title="Production" items={[{ key: "overview", label: "Overview", element: <Overview /> }]} />;
}
