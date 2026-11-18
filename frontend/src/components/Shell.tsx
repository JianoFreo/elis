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
  const [open, setOpen] = useState(false); // phone drawer
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "1"; } catch { return false; }
  });
  function toggleSidebar() {
    if (window.matchMedia("(max-width: 767px)").matches) return setOpen(true);
    setCollapsed((c) => {
      try { localStorage.setItem("sidebar-collapsed", c ? "0" : "1"); } catch { /* storage unavailable */ }
      return !c;
    });
  }
  const [params, setParams] = useSearchParams();
  const current = items.find((i) => i.key === params.get("page")) ?? items[0];
  const user = JSON.parse(sessionStorage.getItem("user") ?? "{}");

  async function logout() {
    try { await api.post("/api/auth/logout"); } catch { /* token may already be invalid */ }
    sessionStorage.clear();
    navigate("/login", { replace: true });
  }

  const navBtn = "relative rounded-lg bg-transparent px-3 py-2.5 text-left font-medium text-stone-600 shadow-none hover:bg-stone-50 hover:text-ink";
  const navOn = "bg-pink-soft font-semibold text-pink-dark hover:bg-pink-soft before:absolute before:inset-y-[20%] before:-left-4 before:w-0.75 before:rounded-r-sm before:bg-pink before:content-['']";
  const initials = String(user.full_name ?? "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex min-h-screen">
      {open && <div className="fixed inset-0 z-40 hidden bg-ink/45 max-md:block" onClick={() => setOpen(false)} />}
      <aside
        className={`${collapsed ? "md:hidden" : "md:w-62"} sticky top-0 flex h-screen flex-none flex-col gap-5 overflow-y-auto border-r border-line bg-white px-4 py-5 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-41 max-md:h-auto max-md:w-65 max-md:max-w-[82vw] max-md:transition-transform ${open ? "max-md:translate-x-0 max-md:shadow-2xl" : "max-md:-translate-x-full"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9.5 flex-none place-items-center rounded-xl bg-linear-to-br from-pink to-pink/60 text-lg font-bold text-white shadow-md shadow-pink/30">E</span>
            <div className="leading-tight">
              <h2 className="m-0 text-[.95rem]">Eli&apos;s Yummy Kitchen</h2>
              <small className="text-xs text-mute">{title}</small>
            </div>
          </div>
          <button className="hidden border border-line bg-white px-3 py-1.5 text-xl leading-none text-ink shadow-none hover:bg-stone-50 max-md:block" aria-label="Close menu" onClick={() => setOpen(false)}>✕</button>
        </div>
        <nav className="grid flex-1 content-start gap-0.5">
          {items.map((i) => (
            <button
              key={i.key}
              className={`${navBtn} ${i.key === current.key ? navOn : ""}`}
              onClick={() => { setParams({ page: i.key }); setOpen(false); }}
            >
              {i.label}
            </button>
          ))}
        </nav>
        <div className="grid gap-3 border-t border-line pt-4 text-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8.5 flex-none place-items-center rounded-full bg-pink-soft text-xs font-semibold text-pink-dark">{initials}</span>
            <div className="grid min-w-0 leading-snug">
              <strong className="truncate">{user.full_name}</strong>
              <span className="text-xs text-mute">{ROLE_LABEL[user.role] ?? user.role}{user.branch ? ` · ${user.branch}` : ""}</span>
            </div>
          </div>
          <button className="border border-line bg-white text-ink shadow-none hover:bg-stone-50" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-2 backdrop-blur md:px-8">
          <button className="border border-line bg-white px-3 py-1.5 text-xl leading-none text-ink shadow-none hover:bg-stone-50" aria-label="Toggle menu" aria-expanded={!collapsed} onClick={toggleSidebar}>☰</button>
          <strong>{current.label}</strong>
          <span className="ml-auto text-xs text-mute">{title}</span>
        </header>
        <section className="p-8 max-md:p-4">{current.element}</section>
      </div>
    </div>
  );
}
