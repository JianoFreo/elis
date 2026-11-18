import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { api } from "../lib/axios";
import { ROLE_LABEL } from "../lib/roles";

export interface NavItem {
  key: string;
  label: string;
  element: React.ReactNode;
}

// Shared layout for every role: sidebar + ?page=<key> content area.
export default function Shell({ title, items }: { title: string; items: NavItem[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const current = items.find((i) => i.key === params.get("page")) ?? items[0];
  const user = JSON.parse(sessionStorage.getItem("user") ?? "{}");

  async function logout() {
    try { await api.post("/api/auth/logout"); } catch { /* token may already be invalid */ }
    sessionStorage.clear();
    navigate("/login", { replace: true });
  }

  return (
    <div className="shell">
      <header className="topbar">
        <button className="menu-btn" aria-label="Menu" onClick={() => setOpen(true)}>☰</button>
        <strong>{current.label}</strong>
        <span className="muted">{title}</span>
      </header>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={open ? "sidebar open" : "sidebar"}>
        <h2>{title}</h2>
        <nav>
          {items.map((i) => (
            <button
              key={i.key}
              className={i.key === current.key ? "nav active" : "nav"}
              onClick={() => { setParams({ page: i.key }); setOpen(false); }}
            >
              {i.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <strong>{user.full_name}</strong>
          <span className="muted">{ROLE_LABEL[user.role] ?? user.role}</span>
          {user.branch && <span className="muted">{user.branch}</span>}
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>
      <section className="content">{current.element}</section>
    </div>
  );
}
