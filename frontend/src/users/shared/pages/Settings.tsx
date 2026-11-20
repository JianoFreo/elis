import { useState } from "react";
import { api } from "../../../lib/axios";
import { errMsg } from "../../../lib/useApi";
import {
  GRADIENTS, THEMES, applyAppearance, backdropOf, normalize,
  type Appearance, type GradientId, type ThemeId,
} from "../../../lib/appearance";
import { Button, Notice, PageHeader } from "../../../components/ui";

const OPTION = "grid gap-2 border bg-white p-3 text-left text-sm font-medium transition hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export default function Settings() {
  const user = JSON.parse(sessionStorage.getItem("user") ?? "{}");
  const [saved, setSaved] = useState<Appearance>(() => normalize(user));
  const [draft, setDraft] = useState<Appearance>(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const dirty = draft.theme !== saved.theme || draft.gradient !== saved.gradient;

  // Picking an option previews it everywhere straight away; it only sticks once saved.
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
      setSaved(next);
      setDraft(next);
      setMsg({ tone: "ok", text: "Appearance saved to your account." });
    } catch (e) {
      setMsg({ tone: "bad", text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Settings"
        subtitle="Choose how your workspace looks. This is saved to your account and follows you to any device."
        actions={<>
          <Button variant="secondary" disabled={!dirty || busy} onClick={() => pick(saved)}>Undo changes</Button>
          <Button disabled={!dirty || busy} onClick={save}>{busy ? "Saving..." : "Save appearance"}</Button>
        </>}
      />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <section className="grid gap-3" aria-labelledby="theme-h">
        <h2 id="theme-h" className="m-0 text-lg font-semibold">Theme</h2>
        <p className="m-0 text-sm text-mute">The accent colour of buttons, highlights and charts.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5" role="group" aria-label="Theme">
          {(Object.keys(THEMES) as ThemeId[]).map((id) => {
            const on = draft.theme === id;
            return (
              <button key={id} type="button" aria-pressed={on} onClick={() => pick({ ...draft, theme: id })} className={`${OPTION} ${on ? "border-ink shadow-soft" : "border-line"}`}>
                <span className="flex h-10 gap-1">
                  <span className="flex-1 rounded-sm" style={{ background: THEMES[id].pink }} />
                  <span className="w-5 rounded-sm" style={{ background: THEMES[id].pinkDark }} />
                  <span className="w-5 rounded-sm" style={{ background: THEMES[id].pinkSoft }} />
                </span>
                <span>{THEMES[id].label}{on ? " (selected)" : ""}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3" aria-labelledby="grad-h">
        <h2 id="grad-h" className="m-0 text-lg font-semibold">Background gradient</h2>
        <p className="m-0 text-sm text-mute">The colours behind the glass panels.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3" role="group" aria-label="Background gradient">
          {(Object.keys(GRADIENTS) as GradientId[]).map((id) => {
            const on = draft.gradient === id;
            return (
              <button key={id} type="button" aria-pressed={on} onClick={() => pick({ ...draft, gradient: id })} className={`${OPTION} ${on ? "border-ink shadow-soft" : "border-line"}`}>
                <span className="h-14 rounded-sm" style={{ background: backdropOf(id) }} />
                <span>{GRADIENTS[id].label}{on ? " (selected)" : ""}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
