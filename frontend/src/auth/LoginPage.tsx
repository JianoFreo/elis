import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { api } from "../lib/axios";
import { ROLE_HOME } from "../lib/roles";

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
    <main className="login-split">
      <section className="login-hero">
        <span className="chip" style={{ alignSelf: "flex-start" }}>Your workspace, beautifully connected</span>
        <h1>Welcome back.</h1>
        <p>Track every batch, every branch, and every sale in one thoughtfully organized workspace.</p>
        <p>From production to weekly sign-off, keep the whole kitchen in view.</p>
        <div className="chips">
          <span className="chip">Main hub + 3 branches</span>
          <span className="chip">Fresh, every day</span>
          <span className="chip">Prepared with care</span>
        </div>
      </section>
      <section className="login-form-side">
        <form className="card login-card" onSubmit={onSubmit}>
          <h1>Eli's Yummy Kitchen</h1>
          <p className="muted">Sign in to your workspace</p>
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required autoComplete="username" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in to dashboard"}</button>
          {SHOW_DEMO && (
            <div className="demo-list">
              <span className="muted">Demo accounts: choose a role</span>
              {DEMOS.map((d) => (
                <button key={d.username} type="button" onClick={() => { setUsername(d.username); setPassword(DEMO_PASSWORD); }}>
                  {d.label} · {d.username}
                </button>
              ))}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
