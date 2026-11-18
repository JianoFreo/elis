import Shell from "../../components/Shell";
import Users from "./pages/Users";
import Products from "./pages/Products";
import Materials from "./pages/Materials";

export default function Owner() {
  return (
    <Shell
      title="Owner"
      items={[
        { key: "users", label: "Accounts", element: <Users /> },
        { key: "products", label: "Product", element: <Products /> },
        { key: "materials", label: "Materials", element: <Materials /> },
      ]}
    />
  );
}
