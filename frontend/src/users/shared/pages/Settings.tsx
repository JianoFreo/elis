import { useState } from "react";
import { api } from "../../../lib/axios";
import { errMsg } from "../../../lib/useApi";
import {
  GRADIENTS, THEMES, applyAppearance, backdropOf, rememberAppearance, customGradient, customTheme, isCustomGradient, isCustomTheme,
  normalize, stopsOf, themeOf, type Appearance, type GradientId, type ThemeId,
} from "../../../lib/appearance";
import { Button, Notice, PageHeader } from "../../../components/ui";
import ColorWheel from "../../../components/ColorWheel";

const OPTION = "grid gap-2 border bg-white p-3 text-left text-sm font-medium transition hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const WHEEL_SWATCH = "conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)";

export default function Settings() {
  const user = JSON.parse(sessionStorage.getItem("user") ?? "{}");
  const [saved, setSaved] = useState<Appearance>(() => normalize(user));
  const [draft, setDraft] = useState<Appearance>(saved);
  // Remembered separately so switching between a preset and Custom does not lose the colours you chose.
  const [accent, setAccent] = useState(() => (isCustomTheme(saved.theme) ? saved.theme.slice(7) : themeOf(saved.theme).pink));
  const [ends, setEnds] = useState<[string, string]>(() => {
    const s = stopsOf(saved.gradient);
    return isCustomGradient(saved.gradient) ? (saved.gradient.slice(7).split(",") as [string, string]) : [s[0], s[3]];
  });
  const [end, setEnd] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const dirty = draft.theme !== saved.theme || draft.gradient !== saved.gradient;
  const customT = isCustomTheme(draft.theme), customG = isCustomGradient(draft.gradient);

  // Picking anything previews it everywhere straight away; it only sticks once saved.
  function pick(next: Appearance) {
    setDraft(next);
    applyAppearance(next);
    setMsg(null);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await api.patch("/api/auth/preferences", draft);
      const next = normalize(data.preferences);
      sessionStorage.setItem("user", JSON.stringify({ ...user, ...next }));
      rememberAppearance(next);
      setSaved(next);
      setDraft(next);
      setMsg({ tone: "ok", text: "Appearance saved to your account." });
    } catch (e) {
      setMsg({ tone: "bad", text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  const tile = (on: boolean) => `${OPTION} ${on ? "border-ink shadow-soft" : "border-line"}`;
  const t = themeOf(draft.theme);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Settings"
        subtitle="Choose how your workspace looks, from a preset or any colour on the wheel. This is saved to your account and follows you to any device."
        actions={<>
          <Button variant="secondary" disabled={!dirty || busy} onClick={() => pick(saved)}>Undo changes</Button>
          <Button disabled={!dirty || busy} onClick={save}>{busy ? "Saving..." : "Save appearance"}</Button>
        </>}
      />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <section className="grid gap-3" aria-labelledby="theme-h">
        <h2 id="theme-h" className="m-0 text-lg font-semibold">Theme</h2>
        <p className="m-0 text-sm text-mute">The accent colour of buttons, highlights and charts.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6" role="group" aria-label="Theme">
          {(Object.keys(THEMES) as ThemeId[]).map((id) => {
            const on = draft.theme === id;
            return (
              <button key={id} type="button" aria-pressed={on} onClick={() => pick({ ...draft, theme: id })} className={tile(on)}>
                <span className="flex h-10 gap-1">
                  <span className="flex-1 rounded-sm" style={{ background: THEMES[id].pink }} />
                  <span className="w-5 rounded-sm" style={{ background: THEMES[id].pinkDark }} />
                  <span className="w-5 rounded-sm" style={{ background: THEMES[id].pinkSoft }} />
                </span>
                <span>{THEMES[id].label}{on ? " (selected)" : ""}</span>
              </button>
            );
          })}
          <button type="button" aria-pressed={customT} onClick={() => pick({ ...draft, theme: customTheme(accent) })} className={tile(customT)}>
            <span className="h-10 rounded-sm" style={{ background: WHEEL_SWATCH }} />
            <span>Custom{customT ? " (selected)" : ""}</span>
          </button>
        </div>
        {customT && (
          <div className="grid gap-4 border border-line bg-white p-4 md:grid-cols-[auto_1fr] md:items-start md:gap-8">
            <ColorWheel label="Accent colour" value={accent} onChange={(hex) => { setAccent(hex); pick({ ...draft, theme: customTheme(hex) }); }} />
            <div className="grid content-start gap-3">
              <p className="m-0 text-sm text-mute">Your colour is adjusted slightly where needed so button text and highlights stay easy to read.</p>
              <span className="flex h-10 max-w-sm gap-1" aria-hidden="true">
                <span className="flex-1 rounded-sm" style={{ background: t.pink }} />
                <span className="w-8 rounded-sm" style={{ background: t.pinkDark }} />
                <span className="w-8 rounded-sm" style={{ background: t.pinkSoft }} />
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="grad-h">
        <h2 id="grad-h" className="m-0 text-lg font-semibold">Background gradient</h2>
        <p className="m-0 text-sm text-mute">The colours behind the glass panels.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" role="group" aria-label="Background gradient">
          {(Object.keys(GRADIENTS) as GradientId[]).map((id) => {
            const on = draft.gradient === id;
            return (
              <button key={id} type="button" aria-pressed={on} onClick={() => pick({ ...draft, gradient: id })} className={tile(on)}>
                <span className="h-14 rounded-sm" style={{ background: backdropOf(id) }} />
                <span>{GRADIENTS[id].label}{on ? " (selected)" : ""}</span>
              </button>
            );
          })}
          <button type="button" aria-pressed={customG} onClick={() => pick({ ...draft, gradient: customGradient(ends[0], ends[1]) })} className={tile(customG)}>
            <span className="h-14 rounded-sm" style={{ background: WHEEL_SWATCH }} />
            <span>Custom{customG ? " (selected)" : ""}</span>
          </button>
        </div>
        {customG && (
          <div className="grid gap-4 border border-line bg-white p-4 md:grid-cols-[auto_1fr] md:items-start md:gap-8">
            <div className="grid gap-3">
              <div className="flex gap-2" role="group" aria-label="Which end of the gradient to edit">
                {(["Start colour", "End colour"] as const).map((name, i) => (
                  <Button key={name} type="button" variant={end === i ? "primary" : "secondary"} aria-pressed={end === i} onClick={() => setEnd(i as 0 | 1)}>
                    <span className="mr-2 inline-block size-3 border border-ink/30 align-middle" style={{ background: ends[i] }} />{name}
                  </Button>
                ))}
              </div>
              <ColorWheel
                label={end === 0 ? "Start colour" : "End colour"}
                value={ends[end]}
                onChange={(hex) => {
                  const next: [string, string] = end === 0 ? [hex, ends[1]] : [ends[0], hex];
                  setEnds(next);
                  pick({ ...draft, gradient: customGradient(next[0], next[1]) });
                }}
              />
            </div>
            <div className="grid content-start gap-3">
              <p className="m-0 text-sm text-mute">Pick a start and an end colour and the app blends between them. </p>
              <span className="h-20 max-w-md border border-line" style={{ background: backdropOf(draft.gradient) }} aria-hidden="true" />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
