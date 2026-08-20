import { useState, type FormEvent } from "react";
import { hcApi } from "@/lib/hc-api";

export function HCLogin({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await hcApi.login(username, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hc-login-wrap">
      <form className="hc-login-card" onSubmit={handleSubmit}>
        <div className="hc-brand"><span className="hc-dot" /> HidenCloud</div>
        <p className="hc-version">v2.1.0</p>
        <p className="hc-sub">Sign in to your control panel.</p>
        <label>Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" autoComplete="username" required />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" required />
        {error && <p className="hc-error">{error}</p>}
        <button type="submit" className="hc-primary" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="hc-footer">Press Ctrl+K after login for command palette</p>
      </form>
    </div>
  );
}
