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
    <main className="grid min-h-screen grid-cols-[1.1fr_1fr] max-lg:grid-cols-1">
      <section className="flex flex-col justify-center gap-4 bg-pink p-12 text-white max-lg:p-6 [&_h1]:m-0 [&_h1]:text-4xl [&_h1]:font-bold [&_h1]:text-white [&_p]:m-0 [&_p]:max-w-[34ch]">
        <span className="self-start rounded-sm bg-black/20 px-3 py-1 text-sm">Your workspace, beautifully connected</span>
        <h1 className="mb-4 text-2xl font-semibold tracking-tight max-md:text-xl">Welcome back.</h1>
        <p>Track every batch, every branch, and every sale in one thoughtfully organized workspace.</p>
        <p>From production to weekly sign-off, keep the whole kitchen in view.</p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-sm bg-black/20 px-3 py-1 text-sm">Main hub + 3 branches</span>
          <span className="rounded-sm bg-black/20 px-3 py-1 text-sm">Fresh, every day</span>
          <span className="rounded-sm bg-black/20 px-3 py-1 text-sm">Prepared with care</span>
        </div>
      </section>
      <section className="grid place-items-center p-4">
        <form className="rounded-md border border-line bg-white  grid w-full max-w-sm gap-4 p-8 [&_h1]:m-0 [&_h1]:text-pink [&_p]:m-0 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-sm" onSubmit={onSubmit}>
          <h1 className="mb-4 text-2xl font-semibold tracking-tight max-md:text-xl">Eli's Yummy Kitchen</h1>
          <p className="text-mute">Sign in to your workspace</p>
          <label>
            Username
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required autoComplete="username" />
          </label>
          <label>
            Password
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          {error && <p className="m-0 text-danger">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in to dashboard"}</Button>
          {SHOW_DEMO && (
            <div className="grid gap-1.5 [&_button]:border [&_button]:border-line [&_button]:bg-white [&_button]:text-left [&_button]:text-sm [&_button]:text-ink [&_button]:shadow-none [&_button]:hover:bg-pink-soft">
              <span className="text-mute">Demo accounts: choose a role</span>
              {DEMOS.map((d) => (
                <Button key={d.username} type="button" onClick={() => { setUsername(d.username); setPassword(DEMO_PASSWORD); }}>
                  {d.label} · {d.username}
                </Button>
              ))}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
