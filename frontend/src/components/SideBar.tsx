import { ROLE_LABEL } from "../lib/roles";
import { Icon, CLOSE } from "./icons";

import { Button } from "./ui";

export interface NavItem {
  key: string;
  label: string;
  element: React.ReactNode;
}

interface SideBarProps {
  title: string;
  items: NavItem[];
  currentKey: string;
  open: boolean; // phone drawer
  collapsed: boolean;
  user: { full_name?: string; role?: string; branch?: string | null };
  onSelect: (key: string) => void;
  onClose: () => void;
  onLogout: () => void;
}

const navBtn = "relative px-4 py-2.5 text-left font-medium text-ink/75 hover:bg-white/70 hover:text-ink";
const navOn = "bg-ink font-semibold text-white hover:bg-ink hover:text-white";

export default function SideBar({ title, items, currentKey, open, collapsed, user, onSelect, onClose, onLogout }: SideBarProps) {
  const initials = String(user.full_name ?? "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      {open && <div className="fixed inset-0 z-40 hidden bg-ink/45 max-md:block" onClick={onClose} />}
      <aside
        className={`${collapsed ? "md:hidden" : "md:w-64"} sticky top-4 flex h-[calc(100vh-2rem)] flex-none flex-col gap-5 overflow-y-auto rounded-xl border border-white/60 bg-white/70 px-4 py-5 shadow-soft backdrop-blur-xl max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-41 max-md:h-auto max-md:rounded-l-none max-md:w-65 max-md:max-w-[82vw] max-md:transition-transform ${open ? "max-md:translate-x-0 max-md:shadow-2xl" : "max-md:-translate-x-full"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9.5 flex-none place-items-center rounded-full bg-pink text-lg font-bold text-ink shadow-soft">E</span>
            <div className="leading-tight">
              <h2 className="m-0 text-[.95rem] font-semibold">Eli&apos;s Yummy Kitchen</h2>
              <small className="text-xs text-mute">{title}</small>
            </div>
          </div>
          <Button variant="bare" className="hidden size-9 place-items-center bg-transparent p-0 text-mute hover:bg-pink-soft hover:text-ink max-md:grid" aria-label="Close menu" onClick={onClose}><Icon d={CLOSE} /></Button>
        </div>
        <nav className="grid flex-1 content-start gap-0.5">
          {items.map((i) => (
            <Button variant="bare" key={i.key} className={`${navBtn} ${i.key === currentKey ? navOn : "bg-transparent"}`} onClick={() => onSelect(i.key)}>
              {i.label}
            </Button>
          ))}
        </nav>
        <div className="grid gap-3 border-t border-ink/10 pt-4 text-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8.5 flex-none place-items-center rounded-full bg-pink-soft text-xs font-semibold text-pink-dark">{initials}</span>
            <div className="grid min-w-0 leading-snug">
              <strong className="truncate">{user.full_name}</strong>
              <span className="text-xs text-mute">{ROLE_LABEL[user.role ?? ""] ?? user.role}{user.branch ? ` · ${user.branch}` : ""}</span>
            </div>
          </div>
          <Button variant="secondary" onClick={onLogout}>Sign out</Button>
        </div>
      </aside>
    </>
  );
}
