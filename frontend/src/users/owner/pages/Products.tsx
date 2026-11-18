import ResourceTable from "../../../components/ResourceTable";

interface Row { product_code: string; name: string; price: string; cost: string; threshold: number; active: boolean }

export default function Products() {
  return (
    <ResourceTable<Row>
      title="Product"
      url="/api/owner/products"
      dataKey="products"
      columns={[
        { header: "Code", render: (r) => r.product_code },
        { header: "Name", render: (r) => r.name },
        { header: "Price", render: (r) => `₱${r.price}` },
        { header: "Cost", render: (r) => `₱${r.cost}` },
        { header: "Low-stock level", render: (r) => r.threshold },
        { header: "Status", render: (r) => (r.active ? "Active" : "Inactive") },
      ]}
    />
  );
}
