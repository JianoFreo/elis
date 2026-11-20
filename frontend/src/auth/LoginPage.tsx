import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { api } from "../lib/axios";
import { ROLE_HOME } from "../lib/roles";
import { Button, Input } from "../components/ui";

// Optional: show quick-fill demo accounts (set VITE_DEMO_ACCOUNTS=true, and VITE_DEMO_PASSWORD to prefill the password).
const SHOW_DEMO = import.meta.env.VITE_DEMO_ACCOUNTS === "true";
const DEMO_PASSWORD = (import.meta.env.VITE_DEMO_PASSWORD as string | undefined) ?? "";
const DEMOS = [
  { username: "juan.delacruz", label: "Business Owner" },
  { username: "ana.reyes", label: "Sales Staff · Main Street" },
  { username: "marco.santos", label: "Production Head" },
  { username: "rica.cruz", label: "Production Staff" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const existingRole = sessionStorage.getItem("role");
  if (sessionStorage.getItem("token") && existingRole && ROLE_HOME[existingRole])
    return <Navigate to={ROLE_HOME[existingRole]} replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { username, password });
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("role", data.user.role);
      sessionStorage.setItem("user", JSON.stringify(data.user));
      navigate(ROLE_HOME[data.user.role] ?? "/login", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-4 md:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-xl border border-white/50 bg-white/35 p-3 shadow-float backdrop-blur-2xl md:grid-cols-2 md:gap-3 md:p-4">
        <form className="grid content-center gap-5 p-5 md:p-10 [&_h1]:m-0 [&_p]:m-0 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-sm [&_label]:font-medium" onSubmit={onSubmit}>
          <span className="grid size-11 place-items-center rounded-full bg-ink text-lg font-bold text-white">E</span>
          <div className="grid gap-1">
            <h1 className="text-4xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-ink/75">Sign in to Eli&apos;s Yummy Kitchen</p>
          </div>
          <label>
            Username
            <Input dark value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your.username" autoFocus required autoComplete="username" />
          </label>
          <label>
            Password
            <Input dark type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required autoComplete="current-password" />
          </label>
          {error && <p role="alert" className="rounded-full bg-bad-bg px-4 py-2 text-sm text-danger">{error}</p>}
          <Button type="submit" className="py-3.5 text-base" disabled={loading}>{loading ? "Signing in..." : "Sign in to dashboard"}</Button>
          {SHOW_DEMO && (
            <div className="grid gap-1.5">
              <span className="text-sm text-ink/75">Demo accounts: choose a role</span>
              {DEMOS.map((d) => (
                <Button key={d.username} variant="secondary" type="button" className="text-left" onClick={() => { setUsername(d.username); setPassword(DEMO_PASSWORD); }}>
                  {d.label} ({d.username})
                </Button>
              ))}
            </div>
          )}
        </form>

        <aside className="relative hidden overflow-hidden rounded-lg bg-panel p-10 text-white md:block" aria-label="About the workspace">
          <svg className="pointer-events-none absolute -bottom-10 -right-10 size-80 text-violet/80" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            {Array.from({ length: 24 }, (_, n) => {
              const a = (n / 24) * Math.PI * 2;
              const inner = n % 2 ? 26 : 18;
              const outer = n % 2 ? 62 : 92;
              return <line key={n} x1={100 + Math.cos(a) * inner} y1={100 + Math.sin(a) * inner} x2={100 + Math.cos(a) * outer} y2={100 + Math.sin(a) * outer} />;
            })}
          </svg>
          <h2 className="relative m-0 max-w-[14ch] text-4xl font-bold leading-tight tracking-tight">Every batch, every branch, every sale.</h2>
          <p className="relative mt-4 max-w-[32ch] text-white/75">Production, dispatch and sales stay in one workspace, from the main hub to each branch counter.</p>
          <div className="relative mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm">Main hub + 3 branches</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm">Works offline at the counter</span>
          </div>
          <div className="absolute bottom-8 left-8 right-8 rounded-lg bg-white p-5 text-ink shadow-float">
            <strong className="block text-lg leading-snug">Weekly audits, signed off with confidence.</strong>
            <span className="mt-1 block text-sm text-mute">Counts, deliveries and closings reconcile before the week ends.</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
