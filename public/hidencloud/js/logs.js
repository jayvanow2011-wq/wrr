import { api } from "./api.js";
export function renderLogs() {
    return `
    <h1>Event Logs</h1>
    <p class="page-sub">Real-time event log from all clients and panel activity.</p>
    <div class="client-toolbar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="log-search" placeholder="Filter logs..." />
      </div>
      <div class="filter-group">
        <select id="log-type-filter">
          <option value="all">All Types</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
      </div>
      <div class="bulk-actions">
        <button class="logout" id="refresh-logs">🔄 Refresh</button>
        <button class="logout danger-btn" id="clear-logs">🗑️ Clear All</button>
        <button class="logout" id="export-logs">📥 Export</button>
      </div>
    </div>
    <div class="card">
      <div id="log-list" class="log-list">Loading...</div>
    </div>
  `;
}
export function bindLogs(root) {
    const listEl = root.querySelector("#log-list");
    const searchEl = root.querySelector("#log-search");
    const typeFilter = root.querySelector("#log-type-filter");
    let logs = [];
    async function load() {
        logs = await api.logs();
        render();
    }
    function render() {
        const q = (searchEl?.value ?? "").toLowerCase();
        const type = typeFilter?.value ?? "all";
        const filtered = logs.filter((l) => {
            const matchSearch = !q || l.msg.toLowerCase().includes(q);
            const matchType = type === "all" || l.type === type;
            return matchSearch && matchType;
        });
        if (filtered.length === 0) {
            listEl.innerHTML = '<div class="muted" style="padding:20px;text-align:center">No logs found.</div>';
            return;
        }
        listEl.innerHTML = filtered
            .map((l) => `
        <div class="log-row log-${l.type}">
          <span class="log-badge">${l.type.toUpperCase()}</span>
          <span class="log-msg">${l.msg}</span>
          <span class="log-time">${timeAgo(l.ts)}</span>
        </div>`)
            .join("");
    }
    searchEl?.addEventListener("input", render);
    typeFilter?.addEventListener("change", render);
    root.querySelector("#refresh-logs")?.addEventListener("click", load);
    root.querySelector("#clear-logs")?.addEventListener("click", async () => {
        await api.clearLogs();
        logs = [];
        render();
    });
    root.querySelector("#export-logs")?.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "hidencloud-logs.json";
        a.click();
    });
    void load();
}
function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000)
        return "just now";
    if (diff < 3600000)
        return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000)
        return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}
