import { Icon, MENU } from "./icons";

import { Button } from "./ui";

interface HeaderProps {
  label: string; // current page
  title: string; // role
  collapsed: boolean;
  onToggle: () => void;
}

export default function Header({ label, title, collapsed, onToggle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 rounded-t-xl border-b border-ink/10 bg-white/80 px-4 py-3 backdrop-blur-xl md:px-8">
      <Button variant="bare" className="grid size-9 place-items-center bg-transparent p-0 text-mute hover:bg-pink-soft hover:text-ink" aria-label="Toggle menu" aria-expanded={!collapsed} onClick={onToggle}><Icon d={MENU} /></Button>
      <strong className="text-lg tracking-tight">{label}</strong>
      <span className="ml-auto text-xs text-mute">{title}</span>
    </header>
  );
}
