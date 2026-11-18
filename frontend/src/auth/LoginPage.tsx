import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { api } from "../lib/axios";
import { ROLE_HOME } from "../lib/roles";

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
    <main className="login-wrap">
      <form className="card login-card" onSubmit={onSubmit}>
        <h1>Eli's Yummy Kitchen</h1>
        <p className="muted">Inventory &amp; Sales System</p>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}
