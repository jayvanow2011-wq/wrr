import { useState, useEffect } from "react";
import { hcApi } from "@/lib/hc-api";
import { HCLogin } from "./HCLogin";
import { HCDashboard } from "./HCDashboard";
import { HCClients } from "./HCClients";
import { HCBuilder } from "./HCBuilder";
import { HCLogs } from "./HCLogs";

type Tab = "dashboard" | "clients" | "builder" | "logs";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "clients", label: "Clients", icon: "◉" },
  { id: "builder", label: "Builder", icon: "▶" },
  { id: "logs", label: "Logs", icon: "≡" },
];

export function HCPanel() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [user, setUser] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    hcApi.me().then(res => {
      if (res.ok && res.user) {
        setAuthed(true);
        setUser(res.user!);
        loadData();
      } else {
        setAuthed(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!authed) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [authed]);

  async function loadData() {
    try {
      const d = await hcApi.stats();
      setData(d);
    } catch {}
  }

  function handleLogin() {
    hcApi.me().then(res => {
      if (res.ok) {
        setAuthed(true);
        setUser(res.user!);
        loadData();
      }
    });
  }

  async function handleLogout() {
    await hcApi.logout();
    setAuthed(false);
    setUser("");
    setData(null);
  }

  if (authed === null) return <div className="hc-root"><div className="hc-login-wrap"><div className="hc-muted">Loading…</div></div></div>;
  if (!authed) return <div className="hc-root"><HCLogin onSuccess={handleLogin} /></div>;

  const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="hc-root">
      <div className="hc-shell">
        <aside className="hc-sidebar">
          <div className="hc-brand"><span className="hc-dot" /> HidenCloud</div>
          <div className="hc-version">v2.1.0</div>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`hc-nav-btn ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="hc-nav-icon">{t.icon}</span>{t.label}
            </button>
          ))}
          <div className="hc-spacer" />
          <div className="hc-sidebar-status">
            <div className="hc-status-dot hc-online" />
            <div>
              <div className="hc-sidebar-user">{user}</div>
              <div className="hc-mono hc-muted" style={{ fontSize: 11 }}>{h}:{m}:{s}</div>
            </div>
          </div>
          <button className="hc-logout-btn" onClick={handleLogout}>Sign out</button>
        </aside>
        <main className="hc-main">
          {tab === "dashboard" && <HCDashboard data={data} />}
          {tab === "clients" && <HCClients data={data} />}
          {tab === "builder" && <HCBuilder />}
          {tab === "logs" && <HCLogs />}
        </main>
      </div>
    </div>
  );
}
