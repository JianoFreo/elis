import { useEffect, useRef, useState } from "react";
import { hexToHsv, hsvToHex, isHex } from "../lib/appearance";
import { Input } from "./ui";

const SIZE = 192; // px

// Colour wheel: angle is the hue, distance from the centre is the saturation, the slider below is brightness.
// Drag (mouse, touch or pen), use the arrow keys on the wheel, or type a hex value.
export default function ColorWheel({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [text, setText] = useState(value);

  // Follow outside changes (another colour selected) without losing the hue when the colour is grey or black.
  useEffect(() => {
    if (hsvToHex(...hsv) !== value) { setHsv(hexToHsv(value)); }
    setText(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const [h, s, v] = hsv;
  const commit = (next: [number, number, number]) => { setHsv(next); onChange(hsvToHex(...next)); };

  function fromPointer(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const hue = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    commit([hue, Math.min(1, Math.hypot(dx, dy) / (r.width / 2)), v]);
  }

  function onKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 1 : 5;
    const moves: Record<string, [number, number]> = { ArrowRight: [step, 0], ArrowLeft: [-step, 0], ArrowUp: [0, step / 100], ArrowDown: [0, -step / 100] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    commit([(h + m[0] + 360) % 360, Math.min(1, Math.max(0, s + m[1])), v]);
  }

  const rad = (h * Math.PI) / 180, R = SIZE / 2;
  const thumb = { left: R + Math.sin(rad) * s * R, top: R - Math.cos(rad) * s * R };

  return (
    <div className="grid justify-items-start gap-3">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={`${label}: hue and saturation. Use the arrow keys, or type a hex value below.`}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(h)}
        aria-valuetext={`hue ${Math.round(h)} degrees, saturation ${Math.round(s * 100)} percent`}
        onKeyDown={onKey}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
        onPointerMove={(e) => { if (e.buttons) fromPointer(e); }}
        className="relative cursor-crosshair touch-none select-none rounded-full shadow-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        style={{ width: SIZE, height: SIZE, background: "radial-gradient(circle closest-side, #fff, rgb(255 255 255 / 0)), conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-full bg-black" style={{ opacity: 1 - v }} />
        <span
          className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-float"
          style={{ left: thumb.left, top: thumb.top, background: value }}
        />
      </div>

      <label className="grid w-full max-w-48 gap-1 text-sm font-medium">
        Brightness
        <input
          type="range" min={0} max={100} value={Math.round(v * 100)} aria-label={`${label}: brightness`}
          onChange={(e) => commit([h, s, Math.max(0.01, Number(e.target.value) / 100)])}
          className="w-full accent-ink"
        />
      </label>

      <label className="grid w-full max-w-48 gap-1 text-sm font-medium">
        Hex colour
        <Input
          value={text} maxLength={7} spellCheck={false} aria-label={`${label}: hex colour`}
          onChange={(e) => {
            const t = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setText(t);
            if (isHex(t)) { setHsv(hexToHsv(t.toLowerCase())); onChange(t.toLowerCase()); }
          }}
          onBlur={() => setText(value)}
        />
      </label>
    </div>
  );
}
