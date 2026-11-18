import ResourceTable from "../../../components/ResourceTable";
import { ROLE_LABEL } from "../../../lib/roles";

interface Row {
  user_id: string; username: string; full_name: string; role: string;
  branch: string | null; account_status: boolean;
}

export default function Users() {
  return (
    <ResourceTable<Row>
      title="Accounts"
      url="/api/owner/users"
      dataKey="users"
      columns={[
        { header: "ID", render: (r) => r.user_id },
        { header: "Name", render: (r) => r.full_name },
        { header: "Username", render: (r) => r.username },
        { header: "Role", render: (r) => ROLE_LABEL[r.role] ?? r.role },
        { header: "Branch", render: (r) => r.branch ?? "All branches" },
        { header: "Status", render: (r) => (r.account_status ? "Active" : "Deactivated") },
      ]}
    />
  );
}
