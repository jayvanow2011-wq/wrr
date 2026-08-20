import { api } from "./api.js";
import { renderLogin } from "./login.js";
import { renderDashboard } from "./dashboard.js";
import { renderClients, bindClients } from "./clients.js";
import { renderBuilder, bindBuilder } from "./builder.js";
import { renderAdminControl, bindAdminControl } from "./admin-control.js";
import { renderLogs, bindLogs } from "./logs.js";
import { renderSettings, bindSettings } from "./settings.js";
const root = document.getElementById("app");
const TABS = [
    { id: "dashboard", label: "Dashboard", icon: "⊞" },
    { id: "clients", label: "Clients", icon: "◉" },
    { id: "builder", label: "Builder", icon: "▶" },
    { id: "logs", label: "Logs", icon: "≡" },
    { id: "settings", label: "Settings", icon: "⚙" },
];
let currentTab = "dashboard";
let connectedId = null;
let data = null;
let sessionStart = Date.now();
let currentUser = "user";
let currentUserId = 0;
async function showPanel() {
    try {
        const me = await fetch("/api/me");
        if (me.ok) {
            const info = await me.json();
            currentUser = info.user;
            currentUserId = info.userId;
        }
    }
    catch { }
    data = await api.stats();
    sessionStart = Date.now();
    root.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="dot"></span> HidenCloud</div>
        <div class="sidebar-version">v2.1.0</div>
        ${TABS.map((t) => `<button class="nav-btn" data-tab="${t.id}"><span class="nav-icon">${t.icon}</span>${t.label}</button>`).join("")}
        <div class="spacer"></div>
        <div class="sidebar-status">
          <div class="status-dot online-dot"></div>
          <div>
            <div class="sidebar-user">${currentUser}</div>
            <div class="sidebar-timer" id="session-timer">00:00:00</div>
          </div>
        </div>
        <button class="logout" id="logout">Sign out</button>
      </aside>
      <main class="main" id="view"></main>
    </div>

    <div class="cmd-palette-overlay" id="cmd-overlay" style="display:none">
      <div class="cmd-palette">
        <input id="cmd-input" placeholder="Type a command… (Ctrl+K)" />
        <div id="cmd-results" class="cmd-results"></div>
      </div>
    </div>
  `;
    root.querySelectorAll(".nav-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            currentTab = btn.dataset["tab"];
            connectedId = null;
            renderTab();
        });
    });
    root.querySelector("#logout").addEventListener("click", async () => {
        await api.logout();
        boot();
    });
    const timerEl = root.querySelector("#session-timer");
    setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
        const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
        const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
        const s = String(elapsed % 60).padStart(2, "0");
        timerEl.textContent = `${h}:${m}:${s}`;
    }, 1000);
    setupCommandPalette();
    renderTab();
}
function setupCommandPalette() {
    const overlay = document.getElementById("cmd-overlay");
    const input = document.getElementById("cmd-input");
    const results = document.getElementById("cmd-results");
    const commands = [
        { label: "Go to Dashboard", action: () => { currentTab = "dashboard"; connectedId = null; renderTab(); } },
        { label: "Go to Clients", action: () => { currentTab = "clients"; connectedId = null; renderTab(); } },
        { label: "Go to Builder", action: () => { currentTab = "builder"; connectedId = null; renderTab(); } },
        { label: "Go to Logs", action: () => { currentTab = "logs"; connectedId = null; renderTab(); } },
        { label: "Go to Settings", action: () => { currentTab = "settings"; connectedId = null; renderTab(); } },
        { label: "Refresh Data", action: async () => { data = await api.stats(); renderTab(); } },
        { label: "Sign Out", action: async () => { await api.logout(); boot(); } },
    ];
    function show() { overlay.style.display = "flex"; input.value = ""; input.focus(); renderCommands(""); }
    function hide() { overlay.style.display = "none"; }
    function renderCommands(q) {
        const filtered = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
        results.innerHTML = filtered.map((c, i) => `<div class="cmd-item${i === 0 ? " active" : ""}" data-idx="${i}">${c.label}</div>`).join("");
        results.querySelectorAll(".cmd-item").forEach((el) => {
            el.addEventListener("click", () => {
                const idx = Number(el.dataset["idx"]);
                const filtered2 = commands.filter((c2) => c2.label.toLowerCase().includes((input.value ?? "").toLowerCase()));
                filtered2[idx]?.action();
                hide();
            });
        });
    }
    input.addEventListener("input", () => renderCommands(input.value));
    input.addEventListener("keydown", (e) => { if (e.key === "Escape")
        hide(); if (e.key === "Enter")
        results.querySelector(".cmd-item")?.click(); });
    overlay.addEventListener("click", (e) => { if (e.target === overlay)
        hide(); });
    document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        overlay.style.display === "none" ? show() : hide();
    } });
}
async function renderTab() {
    const view = root.querySelector("#view");
    root.querySelectorAll(".nav-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset["tab"] === currentTab);
    });
    if (currentTab === "dashboard") {
        view.innerHTML = renderDashboard(data);
        return;
    }
    if (currentTab === "builder") {
        view.innerHTML = renderBuilder();
        bindBuilder(view);
        return;
    }
    if (currentTab === "logs") {
        view.innerHTML = renderLogs();
        bindLogs(view);
        return;
    }
    if (currentTab === "settings") {
        view.innerHTML = renderSettings();
        bindSettings(view);
        return;
    }
    if (connectedId) {
        view.innerHTML = `<div class="card loading-card"><div class="loader"></div>Connecting to ${connectedId}…</div>`;
        try {
            const detail = await api.client(connectedId);
            view.innerHTML = renderAdminControl(detail);
            bindAdminControl(view, detail, () => { connectedId = null; void renderTab(); });
        }
        catch {
            connectedId = null;
            view.innerHTML = `<div class="card">Failed to connect.</div>`;
        }
        return;
    }
    view.innerHTML = renderClients(data);
    bindClients(view);
    view.querySelectorAll(".connect-btn").forEach((btn) => {
        btn.addEventListener("click", () => { connectedId = btn.dataset["id"] ?? null; void renderTab(); });
    });
}
async function boot() {
    if (await api.me()) {
        await showPanel();
    }
    else {
        renderLogin(root, () => void showPanel());
    }
}
void boot();
