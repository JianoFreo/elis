import InventoryList from "../components/Inventory/InventoryList";
import ProductDetail from "../components/Inventory/ProductDetail";
import { useGo } from "../../../lib/nav";

export default function Inventory() {
  const { id } = useGo();
  return id ? <ProductDetail code={id} /> : <InventoryList />;
}
