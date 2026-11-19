import { Icon, MENU } from "./icons";

interface HeaderProps {
  label: string; // current page
  title: string; // role
  collapsed: boolean;
  onToggle: () => void;
}

export default function Header({ label, title, collapsed, onToggle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-2 md:px-8">
      <button className="grid size-9 place-items-center rounded bg-transparent p-0 text-mute shadow-none hover:bg-black/5 hover:text-ink" aria-label="Toggle menu" aria-expanded={!collapsed} onClick={onToggle}><Icon d={MENU} /></button>
      <strong>{label}</strong>
      <span className="ml-auto text-xs text-mute">{title}</span>
    </header>
  );
}
