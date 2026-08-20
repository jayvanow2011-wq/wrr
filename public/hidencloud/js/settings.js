export function renderSettings() {
    return `
    <h1>Settings</h1>
    <p class="page-sub">Panel configuration and preferences.</p>

    <div class="settings-grid">
      <div class="card">
        <h2 style="margin-top:0">👤 Profile</h2>
        <label for="s-user">Username</label>
        <input id="s-user" value="jayjay" disabled />
        <label for="s-email">Email</label>
        <input id="s-email" value="admin@hidencloud.io" />
        <label for="s-tz">Timezone</label>
        <select id="s-tz">
          <option>UTC</option>
          <option selected>Europe/Berlin</option>
          <option>America/New_York</option>
          <option>Asia/Tokyo</option>
        </select>
        <button class="primary" style="margin-top:12px">Save Profile</button>
      </div>

      <div class="card">
        <h2 style="margin-top:0">🔒 Security</h2>
        <label for="s-pass">New Password</label>
        <input id="s-pass" type="password" placeholder="••••••••" />
        <label for="s-pass2">Confirm Password</label>
        <input id="s-pass2" type="password" placeholder="••••••••" />
        <div class="toggle-row">
          <span>Two-factor authentication</span>
          <label class="toggle"><input type="checkbox" /><span class="toggle-slider"></span></label>
        </div>
        <div class="toggle-row">
          <span>Session timeout (30m)</span>
          <label class="toggle"><input type="checkbox" checked /><span class="toggle-slider"></span></label>
        </div>
        <button class="primary" style="margin-top:12px">Update Security</button>
      </div>

      <div class="card">
        <h2 style="margin-top:0">🔔 Notifications</h2>
        <div class="toggle-row">
          <span>Client goes online</span>
          <label class="toggle"><input type="checkbox" checked /><span class="toggle-slider"></span></label>
        </div>
        <div class="toggle-row">
          <span>Client goes offline</span>
          <label class="toggle"><input type="checkbox" checked /><span class="toggle-slider"></span></label>
        </div>
        <div class="toggle-row">
          <span>Threat detected</span>
          <label class="toggle"><input type="checkbox" checked /><span class="toggle-slider"></span></label>
        </div>
        <div class="toggle-row">
          <span>New keylog buffer</span>
          <label class="toggle"><input type="checkbox" /><span class="toggle-slider"></span></label>
        </div>
        <div class="toggle-row">
          <span>Screenshot captured</span>
          <label class="toggle"><input type="checkbox" /><span class="toggle-slider"></span></label>
        </div>
        <div class="toggle-row">
          <span>Desktop notifications</span>
          <label class="toggle"><input type="checkbox" /><span class="toggle-slider"></span></label>
        </div>
      </div>

      <div class="card">
        <h2 style="margin-top:0">🎨 Appearance</h2>
        <div class="toggle-row">
          <span>Ultra-dark mode</span>
          <label class="toggle"><input type="checkbox" id="ultra-dark" /><span class="toggle-slider"></span></label>
        </div>
        <div class="toggle-row">
          <span>Compact sidebar</span>
          <label class="toggle"><input type="checkbox" /><span class="toggle-slider"></span></label>
        </div>
        <div class="toggle-row">
          <span>Show animations</span>
          <label class="toggle"><input type="checkbox" checked /><span class="toggle-slider"></span></label>
        </div>
        <label>Accent color</label>
        <div class="color-picker">
          <button class="color-dot active" data-color="#4f8cff" style="background:#4f8cff"></button>
          <button class="color-dot" data-color="#ff5c72" style="background:#ff5c72"></button>
          <button class="color-dot" data-color="#29d3a2" style="background:#29d3a2"></button>
          <button class="color-dot" data-color="#f59e0b" style="background:#f59e0b"></button>
          <button class="color-dot" data-color="#a855f7" style="background:#a855f7"></button>
          <button class="color-dot" data-color="#ec4899" style="background:#ec4899"></button>
        </div>
      </div>

      <div class="card" style="grid-column: 1 / -1">
        <h2 style="margin-top:0">🔗 API & Webhooks</h2>
        <label>API Key</label>
        <div class="api-key-row">
          <input value="hc_live_9f21a3b7e201dc988fa4cc291" disabled class="mono" />
          <button class="logout">📋 Copy</button>
          <button class="logout danger-btn">🔄 Regenerate</button>
        </div>
        <label>Webhook URL</label>
        <input placeholder="https://your-server.com/webhook" />
        <div class="toggle-row">
          <span>Enable webhook notifications</span>
          <label class="toggle"><input type="checkbox" /><span class="toggle-slider"></span></label>
        </div>
      </div>
    </div>
  `;
}
export function bindSettings(root) {
    // Color picker
    root.querySelectorAll(".color-dot").forEach((dot) => {
        dot.addEventListener("click", () => {
            root.querySelectorAll(".color-dot").forEach((d) => d.classList.remove("active"));
            dot.classList.add("active");
            document.documentElement.style.setProperty("--accent", dot.dataset["color"] ?? "#4f8cff");
        });
    });
    // Ultra dark
    root.querySelector("#ultra-dark")?.addEventListener("change", (e) => {
        const checked = e.target.checked;
        document.documentElement.style.setProperty("--bg", checked ? "#000000" : "#0b0e14");
        document.documentElement.style.setProperty("--surface", checked ? "#080808" : "#121722");
        document.documentElement.style.setProperty("--surface-2", checked ? "#0c0c0c" : "#171d2b");
    });
}
