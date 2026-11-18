import { useEffect, useState } from "react";
import { api } from "../../../lib/axios";
import { ROLE_LABEL } from "../../../lib/roles";
import { ownerService } from "../../../services/owner.service";
import type { UserRow } from "../../../interface/owner";

export default function Users() {
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [error, setError] = useState("");
  const me = JSON.parse(sessionStorage.getItem("user") ?? "{}").user_id;

  const load = () =>
    api.get("/api/owner/users")
      .then((r) => setRows(r.data.users))
      .catch((e) => setError(e.response?.data?.message ?? "Failed to load"));

  useEffect(() => { load(); }, []);

  async function toggle(u: UserRow) {
    setError("");
    try {
      await ownerService.setUserStatus(u.user_id, !u.account_status);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? "Update failed");
    }
  }

  return (
    <div>
      <h1>Accounts</h1>
      {error && <p className="error">{error}</p>}
      {!rows && !error && <p className="muted">Loading...</p>}
      {rows && (
        <table className="card">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Username</th><th>Role</th><th>Branch</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.user_id}>
                <td>{u.user_id}</td>
                <td>{u.full_name}</td>
                <td>{u.username}</td>
                <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                <td>{u.branch ?? "All branches"}</td>
                <td>{u.account_status ? "Active" : "Deactivated"}</td>
                <td>
                  {u.user_id !== me && (
                    <button onClick={() => toggle(u)}>{u.account_status ? "Deactivate" : "Activate"}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
