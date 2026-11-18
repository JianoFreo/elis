import ResourceTable from "../../../components/ResourceTable";

interface Row {
  material_code: string; name: string; category: string | null; unit: string;
  cost: string; threshold: string; supplier: string | null;
}

export default function Materials() {
  return (
    <ResourceTable<Row>
      title="Materials"
      url="/api/owner/materials"
      dataKey="materials"
      columns={[
        { header: "Code", render: (r) => r.material_code },
        { header: "Name", render: (r) => r.name },
        { header: "Category", render: (r) => r.category ?? "-" },
        { header: "Unit", render: (r) => r.unit },
        { header: "Cost / unit", render: (r) => `₱${r.cost}` },
        { header: "Supplier", render: (r) => r.supplier ?? "-" },
      ]}
    />
  );
}
