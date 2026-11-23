import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { api } from "../lib/axios";
import { applySavedAppearance } from "../lib/appearance";
import { ROLE_HOME } from "../lib/roles";
import "./login.css";

const SHOW_DEMO = import.meta.env.VITE_DEMO_ACCOUNTS === "true";
const DEMO_PASSWORD = (import.meta.env.VITE_DEMO_PASSWORD as string | undefined) ?? "";
const REMEMBER_KEY = "eyk:login-username";
const DEMOS = [
  { username: "juan.delacruz", label: "Business Owner" },
  { username: "ana.reyes", label: "Sales Staff · Main Street" },
  { username: "marco.santos", label: "Production Head" },
  { username: "rica.cruz", label: "Production Staff" },
];

const readLocal = (key: string) => { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } };

function Eye({ crossed }: { crossed: boolean }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" />{crossed && <path d="m3 3 18 18" />}</svg>; }

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(() => readLocal(REMEMBER_KEY));
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [remember, setRemember] = useState(() => Boolean(readLocal(REMEMBER_KEY)));
  const [online, setOnline] = useState(() => navigator.onLine);
  const [showHelp, setShowHelp] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const existingRole = sessionStorage.getItem("role");
  if (sessionStorage.getItem("token") && existingRole && ROLE_HOME[existingRole]) return <Navigate to={ROLE_HOME[existingRole]} replace />;

  useEffect(() => { const f = () => setOnline(navigator.onLine); window.addEventListener("online", f); window.addEventListener("offline", f); return () => { window.removeEventListener("online", f); window.removeEventListener("offline", f); }; }, []);
  useEffect(() => { (username ? passwordRef : usernameRef).current?.focus(); }, []);
  useEffect(() => { applySavedAppearance(); }, []); // wear the theme this device last used
  const clearError = () => error && setError("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); const name = username.trim();
    if (!name) { setError("Enter your username or email."); usernameRef.current?.focus(); return; }
    if (!password) { setError("Enter your password."); passwordRef.current?.focus(); return; }
    if (!online) { setError("Sign-in needs an internet connection. Reconnect and try again."); return; }
    setError(""); setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { username: name, password });
      try { remember ? localStorage.setItem(REMEMBER_KEY, name) : localStorage.removeItem(REMEMBER_KEY); } catch { /* unavailable */ }
      sessionStorage.setItem("token", data.token); sessionStorage.setItem("role", data.user.role); sessionStorage.setItem("user", JSON.stringify(data.user));
      applySavedAppearance(); navigate(ROLE_HOME[data.user.role] ?? "/login", { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message?.toLowerCase?.() ?? "";
      if (msg.includes("deactiv") || msg.includes("lock")) setError("This account is locked or disabled. Contact the Business Owner.");
      else if (err.response?.status === 401 || msg.includes("credential")) { setError("Username or password is incorrect."); passwordRef.current?.focus(); }
      else if (!err.response) setError("The server could not be reached. Check your connection and try again.");
      else setError(err.response.data?.message ?? "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }

  function chooseDemo(d: typeof DEMOS[number]) { setUsername(d.username); setPassword(DEMO_PASSWORD); setError(""); requestAnimationFrame(() => submitRef.current?.focus()); }

  return <main className="login-page min-h-screen px-4 py-6 text-[#202438] transition-colors sm:px-6 sm:py-8 motion-reduce:transition-none">
    <div className="login-stage mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-6xl place-items-center py-8"><div className="login-card grid w-full overflow-hidden rounded-[1.75rem] border border-[#e1e4ee] bg-white shadow-[0_24px_70px_rgba(35,42,72,0.12)] md:grid-cols-[minmax(0,1fr)_0.86fr]">
      <form onSubmit={onSubmit} noValidate className="login-form grid gap-6 p-7 sm:p-10 lg:p-14">
        <div className="flex items-center gap-3"><div className="login-logo overflow-hidden shadow-lg"><img src="/logo.png" alt="Eli&apos;s Yummy Kitchen" width={150} height={150} className="size-full object-cover" /></div><div><span className="text-sm text-[#778097]">Inventory &amp; sales workspace</span></div></div>
        <div className="grid gap-2"><h1 className="m-0 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Welcome back</h1><p className="m-0 text-[#657087]">Sign in to continue to your workspace.</p></div>
        <div className="grid gap-4"><label className="grid gap-2 text-sm font-medium" htmlFor="username">Username or email<input ref={usernameRef} id="username" value={username} onChange={e => { setUsername(e.target.value); clearError(); }} placeholder="your.username" autoComplete="username" className="h-12 w-full rounded-xl border border-[#d8dce7] bg-[#fbfcfe] px-4 text-[#202438] outline-none transition placeholder:text-[#9ba3b5] focus:border-pink-dark focus:ring-4 focus:ring-pink/30" /></label><label className="grid gap-2 text-sm font-medium" htmlFor="password">Password<span className="relative"><input ref={passwordRef} id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => { setPassword(e.target.value); clearError(); }} onKeyUp={e => setCapsLock(e.getModifierState("CapsLock"))} onBlur={() => setCapsLock(false)} placeholder="Enter your password" autoComplete="current-password" className="h-12 w-full rounded-xl border border-[#d8dce7] bg-[#fbfcfe] px-4 pr-12 text-[#202438] outline-none transition placeholder:text-[#9ba3b5] focus:border-pink-dark focus:ring-4 focus:ring-pink/30" /><button type="button" onClick={() => { setShowPassword(!showPassword); requestAnimationFrame(() => passwordRef.current?.focus()); }} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#778097] hover:bg-[#eef0f7] focus-visible:outline-2 focus-visible:outline-pink-dark"><Eye crossed={!showPassword} /></button></span></label>{capsLock && <p className="m-0 text-xs font-medium text-[#a15c00]" role="status">Caps Lock is on</p>}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><label className="flex items-center gap-2 text-[#657087]"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="size-4 accent-pink-dark" /> Remember me on this device</label><button type="button" onClick={() => setShowHelp(!showHelp)} className="font-medium text-pink-dark underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-pink-dark">Forgot password?</button></div>
        {showHelp && <div className="rounded-xl border border-pink bg-pink-soft px-4 py-3 text-sm text-pink-dark" role="note">Contact the Business Owner or administrator to reset your password.</div>}
        {error && <p role="alert" aria-live="polite" className="m-0 rounded-xl border border-[#f0caca] bg-[#fff2f2] px-4 py-3 text-sm text-[#a63232]">{error}</p>}
        <button ref={submitRef} type="submit" disabled={loading} aria-busy={loading} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-pink-dark px-5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-pink-dark disabled:cursor-not-allowed disabled:opacity-60">{loading && <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" aria-hidden="true" />}{loading ? "Signing in..." : "Sign in to dashboard"}</button>{!online && <p className="m-0 text-center text-xs font-medium text-[#a15c00]" role="status">You are offline. Sign-in needs a connection.</p>}
        {SHOW_DEMO && <div className="grid gap-3 border-t border-[#e7e9f0] pt-5"><div><p className="m-0 text-sm font-semibold">Quick sign-in <span className="font-normal text-[#778097]">(demo)</span></p><p className="m-0 mt-1 text-xs text-[#778097]">Choose a role to fill the form.</p></div><div className="grid gap-2 sm:grid-cols-2">{DEMOS.map(d => <button key={d.username} type="button" onClick={() => chooseDemo(d)} className="rounded-xl border border-[#dfe2eb] px-3 py-2 text-left text-xs text-[#657087] transition hover:border-pink hover:bg-pink-soft focus-visible:outline-2 focus-visible:outline-pink-dark"><strong className="block text-[#30354a]">{d.label}</strong>{d.username}</button>)}</div></div>}
        <p className="m-0 text-center text-xs text-[#8991a4]">Systems Analysis and Design, TUP Manila</p>
      </form>
      <aside className="relative hidden min-h-[600px] overflow-hidden bg-pink-dark p-10 text-white lg:block" aria-label="About the workspace"><div className="absolute -right-20 -top-20 size-80 rounded-full border border-white/10 bg-pink/30 blur-2xl" aria-hidden="true" /><div className="relative flex h-full flex-col justify-between"><div><span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/85">Built for confident operations</span><h2 className="mt-10 max-w-[10ch] text-5xl font-semibold leading-[1.05] tracking-[-0.045em]">Every batch, every branch, every sale.</h2><p className="mt-5 max-w-[32ch] text-sm leading-6 text-white/70">Production, dispatch and sales stay in one workspace, from the main hub to each branch counter.</p></div><div className="rounded-2xl border border-white/10 bg-white/10 p-5"><div className="mb-5 flex items-center gap-2"><span className="size-2 rounded-full bg-pink" /><span className="text-xs font-medium uppercase tracking-wider text-white/60">Weekly control</span></div><strong className="block text-xl leading-snug">Weekly audits, signed off with confidence.</strong><span className="mt-2 block text-sm leading-6 text-white/60">Counts, deliveries and closings reconcile before the week ends.</span></div></div></aside>
    </div></div>
  </main>;
}
