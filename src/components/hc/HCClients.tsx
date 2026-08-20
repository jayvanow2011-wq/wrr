import { useState } from "react";
import { hcApi } from "@/lib/hc-api";

export function HCClients({ data }: { data: any }) {
  const [connected, setConnected] = useState<any>(null);
  const [search, setSearch] = useState("");

  if (!data) return <div className="hc-card">Loading…</div>;

  if (connected) {
    return (
      <div>
        <button className="hc-back-btn" onClick={() => setConnected(null)}>← Back to clients</button>
        <h1>{connected.client.name}</h1>
        <p className="hc-sub">{connected.client.os} • {connected.client.ip} • {connected.client.country}</p>
        <div className="hc-two-col">
          <div className="hc-card">
            <h3 className="hc-section-title">System Info</h3>
            <div className="hc-info-row"><span>CPU</span><span>{connected.client.cpu}</span></div>
            <div className="hc-info-row"><span>RAM</span><span>{connected.client.ram}</span></div>
            <div className="hc-info-row"><span>GPU</span><span>{connected.client.gpu}</span></div>
            <div className="hc-info-row"><span>Uptime</span><span>{connected.client.uptime}</span></div>
            <div className="hc-info-row"><span>AV</span><span>{connected.client.av}</span></div>
          </div>
          <div className="hc-card">
            <h3 className="hc-section-title">File Manager</h3>
            {connected.files.map((f: any) => (
              <div key={f.name} className="hc-info-row">
                <span>{f.type === "folder" ? "📁" : "📄"} {f.name}</span>
                <span className="hc-muted">{f.size}</span>
              </div>
            ))}
          </div>
        </div>
        <h2>Processes</h2>
        <div className="hc-card">
          <table className="hc-table">
            <thead><tr><th>PID</th><th>Name</th><th>CPU</th><th>Memory</th><th>Status</th></tr></thead>
            <tbody>
              {connected.processes.map((p: any) => (
                <tr key={p.pid}>
                  <td className="hc-mono">{p.pid}</td>
                  <td>{p.name}</td>
                  <td>{p.cpu}</td>
                  <td>{p.mem}</td>
                  <td><span className={`hc-badge ${p.status === "running" ? "online" : "idle"}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                  <button className="hc-connect-btn" onClick={async () => {
                    try {
                      const detail = await hcApi.client(c.id);
                      setConnected(detail);
                    } catch {}
                  }}>Connect</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
