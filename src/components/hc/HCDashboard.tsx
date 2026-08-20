export function HCDashboard({ data }: { data: any }) {
  if (!data) return <div className="hc-card">Loading…</div>;
  const a = data.analytics;
  const total = Math.max(a.total, 1);
  const onlinePct = Math.round((a.online / total) * 100);
  const offlinePct = Math.round((a.offline / total) * 100);
  const idlePct = 100 - onlinePct - offlinePct;

  const cards = [
    { label: "Total Clients", value: a.total, delta: `+${a.newToday} today`, tone: "" },
    { label: "Online", value: a.online, delta: `${onlinePct}%`, tone: "ok" },
    { label: "Offline", value: a.offline, delta: `${offlinePct}%`, tone: "warn" },
    { label: "Idle", value: a.idle, delta: `${idlePct}%`, tone: "idle" },
    { label: "Countries", value: a.countries, delta: "worldwide", tone: "" },
    { label: "Builds", value: a.builds || 0, delta: "total", tone: "" },
  ];

  return (
    <div>
      <h1>Dashboard</h1>
      <p className="hc-sub">Live analytics across all connected clients.</p>
      <div className="hc-stat-grid">
        {cards.map(c => (
          <div key={c.label} className="hc-card hc-stat-card">
            <div className="hc-stat-label">{c.label}</div>
            <div className="hc-stat-value">{c.value}</div>
            <div className={`hc-stat-delta ${c.tone}`}>{c.delta}</div>
          </div>
        ))}
      </div>
      <h2>Fleet Status</h2>
      <div className="hc-card">
        <div className="hc-bar">
          <div className="hc-bar-online" style={{ width: `${onlinePct}%` }} />
          <div className="hc-bar-idle" style={{ width: `${idlePct}%` }} />
          <div className="hc-bar-offline" style={{ width: `${offlinePct}%` }} />
        </div>
        <div className="hc-legend">
          <span><i className="hc-dot-online" /> Online {a.online}</span>
          <span><i className="hc-dot-idle" /> Idle {a.idle}</span>
          <span><i className="hc-dot-offline" /> Offline {a.offline}</span>
        </div>
      </div>
      <h2>Clients</h2>
      <div className="hc-card">
        <table className="hc-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>OS</th><th>IP</th><th>Country</th><th>Status</th></tr>
          </thead>
          <tbody>
            {data.clients.map((c: any) => (
              <tr key={c.id}>
                <td className="hc-mono">{c.id}</td>
                <td>{c.name}</td>
                <td>{c.os}</td>
                <td className="hc-mono">{c.ip}</td>
                <td>{c.country}</td>
                <td><span className={`hc-badge ${c.status}`}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
