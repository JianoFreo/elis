import { useState } from "react";
import { api } from "../../../lib/axios";
import { Badge, DataTable, Field, Loading, Modal, Notice, PageHeader, ResultModal } from "../../../components/ui";
import { ROLE_LABEL } from "../../../lib/roles";
import { ownerService } from "../../../services/owner.service";
import { currentUser, errMsg, useApi } from "../../../lib/useApi";
import type { UserRow } from "../../../interface/owner";

interface Perms { role: string; permissions: { capability: string; allowed: boolean }[] }
interface Branches { branches: { id: number; name: string; kind: string }[] }

const ROLES = ["sales-staff", "production-head", "production-staff", "owner"];
const blank = { first: "", surname: "", username: "", password: "", role: "sales-staff", branch_id: "" };

export default function Users() {
  const users = useApi<{ users: UserRow[] }>("/api/owner/users");
  const branches = useApi<Branches>("/api/shared/branches");
  const nextId = useApi<{ user_id: string }>("/api/owner/users/next-id");
  const me = currentUser().user_id;

  const [step, setStep] = useState<0 | 1 | 2>(0); // 0 closed, 1 details, 2 permissions
  const [form, setForm] = useState(blank);
  const perms = useApi<Perms>(step === 2 ? `/api/owner/permissions/${form.role}` : null);
  const [del, setDel] = useState<UserRow | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  if (!users.data) return <Loading loading={users.loading} error={users.error} />;

  const set = (k: keyof typeof blank, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const hub = branches.data?.branches.find((b) => b.kind === "hub");
  const selling = branches.data?.branches.filter((b) => b.kind === "branch") ?? [];
  const needsBranch = form.role === "sales-staff";
  const location = form.role === "owner" ? "All branches" : form.role === "sales-staff" ? selling.find((b) => String(b.id) === form.branch_id)?.name ?? "-" : hub?.name ?? "Main hub";
  const detailsOk = form.first.trim() && form.surname.trim() && /^[a-z0-9._-]{3,}$/i.test(form.username) && form.password.length >= 8 && (!needsBranch || form.branch_id);

  async function create() {
    setBusy(true); setMsg("");
    try {
      const branch_id = form.role === "owner" ? null : form.role === "sales-staff" ? Number(form.branch_id) : hub?.id ?? null;
      const r = await api.post("/api/owner/users", { username: form.username, password: form.password, full_name: `${form.first.trim()} ${form.surname.trim()}`, role: form.role, branch_id });
      setDone(`${r.data.user_id} · ${form.first} ${form.surname} was created as ${ROLE_LABEL[form.role]}. Share the temporary password privately.`);
      setStep(0); setForm(blank); users.reload(); nextId.reload();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  }

  async function toggle(u: UserRow) {
    setMsg("");
    try { await ownerService.setUserStatus(u.user_id, !u.account_status); users.reload(); } catch (e) { setMsg(errMsg(e)); }
  }

  async function remove() {
    if (!del) return;
    setBusy(true); setMsg("");
    try { await api.delete(`/api/owner/users/${del.user_id}`); setDone(`${del.user_id} was removed.`); setDel(null); users.reload(); nextId.reload(); }
    catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="The people behind the kitchen."
        subtitle="Account creation, permissions and deletion"
        actions={<button onClick={() => { setForm(blank); setMsg(""); setStep(1); }}>Create staff account</button>}
      />
      {msg && step === 0 && !del && <p className="m-0 text-danger">{msg}</p>}
      <DataTable
        rows={users.data.users}
        cols={[
          { header: "Account", render: (u) => u.user_id },
          { header: "Name", render: (u) => u.full_name },
          { header: "Username", render: (u) => u.username },
          { header: "Role", render: (u) => ROLE_LABEL[u.role] ?? u.role },
          { header: "Location", render: (u) => u.branch ?? "All branches" },
          { header: "Status", render: (u) => <Badge tone={u.account_status ? "ok" : "muted"}>{u.account_status ? "Active" : "Deactivated"}</Badge> },
          { header: "", render: (u) => u.user_id !== me && (
              <div className="flex flex-wrap gap-1.5">
                <button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => toggle(u)}>{u.account_status ? "Deactivate" : "Activate"}</button>
                <button className="bg-transparent px-1.5 py-1 font-semibold text-pink-dark shadow-none hover:bg-pink-soft" onClick={() => { setMsg(""); setDel(u); }}>Delete</button>
              </div>) },
        ]}
      />

      <Modal
        open={step === 1} onClose={() => setStep(0)} title="Create a staff account"
        footer={<><button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => setStep(0)}>Cancel</button><button disabled={!detailsOk} onClick={() => setStep(2)}>Continue to permissions</button></>}
      >
        <p className="text-mute">Owner-managed access for kitchen and branch staff. Account ID: {nextId.data?.user_id ?? "..."}</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 max-md:grid-cols-1">
          <Field label="First name"><input value={form.first} onChange={(e) => set("first", e.target.value)} /></Field>
          <Field label="Surname"><input value={form.surname} onChange={(e) => set("surname", e.target.value)} /></Field>
          <Field label="Username" hint="Letters, numbers, dot, dash. At least 3."><input value={form.username} onChange={(e) => set("username", e.target.value)} /></Field>
          <Field label="Temporary password" hint="At least 8 characters."><input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} /></Field>
          <Field label="Role">
            <select value={form.role} onChange={(e) => set("role", e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          </Field>
          {needsBranch && (
            <Field label="Branch / location">
              <select value={form.branch_id} onChange={(e) => set("branch_id", e.target.value)}>
                <option value="">Choose a branch</option>{selling.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        <Notice tone="info">Keep the temporary password private. Assign only the permissions needed for the role.</Notice>
      </Modal>

      <Modal
        open={step === 2} onClose={() => setStep(0)} title="Account permissions"
        footer={<><button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => setStep(1)}>Back to account details</button><button disabled={busy} onClick={create}>{busy ? "Saving..." : "Save account & permissions"}</button></>}
      >
        <p className="text-mute">Preset role permissions · {form.first} {form.surname} · {ROLE_LABEL[form.role]} · {location}</p>
        {perms.data
          ? <ul className="m-0 grid list-none gap-2.5 p-0 [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:rounded-md [&>li]:border [&>li]:border-line [&>li]:bg-white [&>li]:px-3.5 [&>li]:py-2.5 max-md:[&>li]:flex-wrap">{perms.data.permissions.map((p) => <li key={p.capability}><span>{p.capability}</span><Badge tone={p.allowed ? "ok" : "muted"}>{p.allowed ? "Allowed" : "Owner only / not assigned"}</Badge></li>)}</ul>
          : <p className="text-mute">Loading...</p>}
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <Modal
        open={!!del} onClose={() => setDel(null)} title="Delete this staff account?"
        footer={<><button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={() => setDel(null)}>Cancel</button><button className="bg-danger hover:bg-danger/90" disabled={busy} onClick={remove}>Delete account</button></>}
      >
        {del && <><p><strong>{del.user_id} · {del.full_name}</strong> · {ROLE_LABEL[del.role]}</p>
          <p className="text-mute">Check the account name and role before confirming deletion. Accounts with recorded activity cannot be deleted; deactivate them instead.</p></>}
        {msg && <p className="m-0 text-danger">{msg}</p>}
      </Modal>

      <ResultModal open={!!done} onClose={() => setDone("")} title="Done">{done}</ResultModal>
    </div>
  );
}
