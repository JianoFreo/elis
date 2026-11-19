import DispatchList from "../components/Dispatch/DispatchList";
import DispatchDetail from "../components/Dispatch/DispatchDetail";
import { useGo } from "../../../lib/nav";

export default function Dispatch() {
  const { id } = useGo();
  return id ? <DispatchDetail code={id} /> : <DispatchList />;
}
