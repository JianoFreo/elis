import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { api } from "../lib/axios";
import SideBar, { type NavItem } from "./SideBar";
import Header from "./Header";

export type { NavItem };

// Shared layout for every role: SideBar + Header + ?page=<key> content area.
export default function Shell({ title, items }: { title: string; items: NavItem[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // phone drawer
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "1"; } catch { return false; }
  });
  const [params, setParams] = useSearchParams();
  const current = items.find((i) => i.key === params.get("page")) ?? items[0];
  const user = JSON.parse(sessionStorage.getItem("user") ?? "{}");

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 767px)").matches) return setOpen(true);
    setCollapsed((c) => {
      try { localStorage.setItem("sidebar-collapsed", c ? "0" : "1"); } catch { /* storage unavailable */ }
      return !c;
    });
  }

  async function logout() {
    try { await api.post("/api/auth/logout"); } catch { /* token may already be invalid */ }
    sessionStorage.clear();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <SideBar
        title={title}
        items={items}
        currentKey={current.key}
        open={open}
        collapsed={collapsed}
        user={user}
        onSelect={(key) => { setParams({ page: key }); setOpen(false); }}
        onClose={() => setOpen(false)}
        onLogout={logout}
      />
      <div className="min-w-0 flex-1">
        <Header label={current.label} title={title} collapsed={collapsed} onToggle={toggleSidebar} />
        <section className="p-8 max-md:p-4">{current.element}</section>
      </div>
    </div>
  );
}
