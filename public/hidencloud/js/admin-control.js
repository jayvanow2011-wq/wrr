import { api } from "./api.js";
import { toast } from "./toast.js";
export function renderAdminControl(detail) {
    const c = detail.client;
    return `
    <div class="ac-header">
      <button class="logout" id="ac-back">← Back to clients</button>
      <div class="ac-title">
        <h1>Admin Control</h1>
        <p class="page-sub">
          Connected to <strong>${c.name}</strong>
          <span class="badge online"><i class="pulse"></i>${c.status}</span>
          <span class="muted"> · latency <span id="ac-ping">—</span> ms</span>
        </p>
      </div>
    </div>

    <div class="grid mini-grid">
      ${miniCard("Client ID", c.id)}
      ${miniCard("User", c.user)}
      ${miniCard("OS", c.os)}
      ${miniCard("IP", c.ip)}
      ${miniCard("CPU", c.cpu)}
      ${miniCard("RAM", c.ram)}
      ${miniCard("GPU", c.gpu)}
      ${miniCard("Uptime", c.uptime)}
      ${miniCard("Country", c.country)}
      ${miniCard("AV", c.av, c.av === "None" ? "warn" : "ok")}
      ${miniCard("Network", c.netSpeed)}
      ${miniCard("Installed", c.installed)}
    </div>

    <div class="ac-tabs" role="tablist">
      <button class="ac-tab active" data-panel="screen">🖥️ Screen</button>
      <button class="ac-tab" data-panel="camera">📷 Camera</button>
      <button class="ac-tab" data-panel="files">📁 Files</button>
      <button class="ac-tab" data-panel="shell">💻 Shell</button>
      <button class="ac-tab" data-panel="keylogger">⌨️ Keylogger</button>
      <button class="ac-tab" data-panel="clipboard">📋 Clipboard</button>
      <button class="ac-tab" data-panel="processes">⚙️ Processes</button>
      <button class="ac-tab" data-panel="actions">🎯 Actions</button>
    </div>

    <div id="ac-panel"></div>
  `;
}
function miniCard(label, value, tone = "") {
    return `<div class="card mini-card"><div class="label">${label}</div><div class="value sm ${tone}">${escapeHtml(value)}</div></div>`;
}
export function bindAdminControl(root, detail, onBack) {
    root.querySelector("#ac-back").addEventListener("click", onBack);
    // live latency ticker
    const pingEl = root.querySelector("#ac-ping");
    const pingInt = window.setInterval(() => {
        if (pingEl)
            pingEl.textContent = String(18 + Math.floor(Math.random() * 32));
    }, 1500);
    const cleanupObs = new MutationObserver(() => {
        if (!document.body.contains(root)) {
            window.clearInterval(pingInt);
            cleanupObs.disconnect();
        }
    });
    cleanupObs.observe(document.body, { childList: true, subtree: true });
    const panelEl = root.querySelector("#ac-panel");
    const tabs = root.querySelectorAll(".ac-tab");
    // Mutable clones so features can add/remove without mutating server payload
    const filesState = [...detail.files];
    const procsState = detail.processes.map((p) => ({ ...p }));
    const keylogState = [...detail.keylogs];
    const clipState = [...detail.clipboard];
    const filePath = [`C:\\Users\\${detail.client.user}`];
    const setPanel = (p) => {
        tabs.forEach((t) => t.classList.toggle("active", t.dataset["panel"] === p));
        panelEl.innerHTML = renderPanel(p, detail, { filesState, procsState, keylogState, clipState, filePath });
        if (p === "shell")
            bindShell(panelEl, detail);
        if (p === "screen")
            bindScreen(panelEl, detail);
        if (p === "camera")
            bindCamera(panelEl, detail);
        if (p === "files")
            bindFiles(panelEl, detail, filesState, filePath, setPanel);
        if (p === "keylogger")
            bindKeylog(panelEl, detail, keylogState, setPanel);
        if (p === "clipboard")
            bindClipboard(panelEl, clipState, setPanel);
        if (p === "processes")
            bindProcesses(panelEl, procsState, setPanel);
        if (p === "actions")
            bindActions(panelEl, detail);
    };
    tabs.forEach((t) => t.addEventListener("click", () => setPanel(t.dataset["panel"])));
    setPanel("screen");
}
function renderPanel(p, detail, s) {
    if (p === "screen") {
        return `
      <div class="card viewer">
        <div class="viewer-toolbar">
          <button class="logout" id="refresh-screen">🔄 Refresh</button>
          <button class="logout" id="save-screen">📸 Save Screenshot</button>
          <button class="logout" id="rec-screen">🎥 Start Recording</button>
          <label class="qual-select"><span class="muted">Quality</span>
            <select id="screen-quality"><option>Low</option><option>Medium</option><option selected>High</option><option>Ultra</option></select>
          </label>
          <span class="muted" id="screen-ts">Capturing…</span>
        </div>
        <div class="viewer-frame" id="screen-frame">
          <div class="scanlines"></div>
          <div class="viewer-desktop">
            <div class="fake-taskbar"><span class="fake-start">■</span><span class="fake-clock" id="screen-clock"></span></div>
            <div class="fake-window">
              <div class="fake-title">C:\\Users\\${detail.client.user}\\Documents</div>
              <div class="fake-body" id="screen-body">
                <p>📄 report.docx</p><p>📊 budget.xlsx</p><p>🔑 passwords.txt</p><p>💰 wallet.dat</p>
              </div>
            </div>
          </div>
          <div class="rec-badge" id="rec-badge" style="display:none">● REC <span id="rec-time">00:00</span></div>
        </div>
        <div class="viewer-info">
          <span class="muted">Resolution: 1920×1080</span>
          <span class="muted" id="fps-info">FPS: ~2</span>
          <span class="muted" id="frame-count">Frames: 0</span>
        </div>
      </div>`;
    }
    if (p === "camera") {
        return `
      <div class="card viewer">
        <div class="viewer-toolbar">
          <button class="logout" id="cam-rec">● Record</button>
          <button class="logout" id="cam-snap">📸 Snapshot</button>
          <select class="cam-select" id="cam-src">
            <option>Front Camera (HD 720p)</option>
            <option>Rear Camera</option>
            <option>External USB</option>
          </select>
          <span class="muted" id="cam-status">Streaming…</span>
        </div>
        <div class="viewer-frame camera">
          <div class="cam-noise"></div>
          <div class="cam-overlay">
            <span class="rec"><i></i> LIVE</span>
            <span class="muted">${detail.client.name} · <span id="cam-label">front camera</span></span>
          </div>
        </div>
      </div>`;
    }
    if (p === "files") {
        const rows = s.filesState.map((f) => fileRow(f)).join("");
        return `
      <div class="card">
        <div class="viewer-toolbar">
          <button class="logout" id="file-up" ${s.filePath.length <= 1 ? "disabled" : ""}>⬆️ Up</button>
          <span class="muted path-crumb">📂 ${escapeHtml(s.filePath.join("\\"))}</span>
          <button class="logout" id="file-upload">⬆️ Upload</button>
          <button class="logout" id="file-newfolder">📁 New Folder</button>
          <button class="logout" id="file-refresh">🔄 Refresh</button>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th><th>Actions</th></tr></thead>
          <tbody id="files-tbody">${rows}</tbody>
        </table>
      </div>`;
    }
    if (p === "keylogger") {
        return `
      <div class="card">
        <div class="viewer-toolbar">
          <span class="muted">⌨️ Live keylog buffer — ${detail.client.name}</span>
          <label class="toggle-inline"><input type="checkbox" id="keylog-live" /> Live capture</label>
          <button class="logout" id="keylog-refresh">🔄 Refresh</button>
          <button class="logout" id="keylog-export">📥 Export</button>
          <button class="logout danger-btn" id="keylog-clear">🗑️ Clear</button>
        </div>
        <table>
          <thead><tr><th>Time</th><th>Window</th><th>Captured Text</th></tr></thead>
          <tbody id="keylog-tbody">${s.keylogState.map(keylogRow).join("")}</tbody>
        </table>
      </div>`;
    }
    if (p === "clipboard") {
        return `
      <div class="card">
        <div class="viewer-toolbar">
          <span class="muted">📋 Clipboard monitor — ${detail.client.name}</span>
          <button class="logout" id="clip-refresh">🔄 Refresh</button>
          <button class="logout" id="clip-export">📥 Export</button>
          <button class="logout danger-btn" id="clip-clear">🗑️ Clear</button>
        </div>
        <table>
          <thead><tr><th>Time</th><th>Content</th><th></th></tr></thead>
          <tbody id="clip-tbody">${s.clipState.map((c) => clipRow(c)).join("")}</tbody>
        </table>
      </div>`;
    }
    if (p === "processes") {
        return `
      <div class="card">
        <div class="viewer-toolbar">
          <span class="muted">⚙️ Process Manager — ${detail.client.name}</span>
          <button class="logout" id="proc-refresh">🔄 Refresh</button>
          <input type="text" id="proc-search" placeholder="Filter processes..." class="inline-input" />
        </div>
        <table>
          <thead><tr><th>PID</th><th>Name</th><th>CPU</th><th>Memory</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="proc-tbody">${s.procsState.map(procRow).join("")}</tbody>
        </table>
      </div>`;
    }
    if (p === "actions") {
        const actions = [
            ["screenshot", "📸", "Screenshot"], ["lock", "🔒", "Lock Screen"], ["shutdown", "⛔", "Shutdown"],
            ["restart", "🔄", "Restart"], ["bsod", "💀", "BSOD"], ["msgbox", "💬", "Message Box"],
            ["openurl", "🌐", "Open URL"], ["wallpaper", "🖼️", "Change Wallpaper"], ["elevate", "⬆️", "Elevate (UAC)"],
            ["persist", "📌", "Add Persistence"], ["keylog-start", "⌨️", "Start Keylogger"], ["download", "📥", "Download & Run"],
            ["disable-av", "🛡️", "Disable AV"], ["steal-tokens", "🎫", "Steal Tokens"], ["dump-wifi", "📶", "Dump WiFi"],
            ["reverse-shell", "🐚", "Reverse Shell"],
        ];
        return `
      <div class="card">
        <h2 style="margin-top:0">🎯 Remote Actions — ${detail.client.name}</h2>
        <p class="muted">Execute commands on the remote machine.</p>
        <div class="actions-grid">
          ${actions.map(([a, i, l]) => `<button class="action-card" data-action="${a}"><span class="action-icon">${i}</span><span>${l}</span></button>`).join("")}
        </div>
        <div id="action-result" class="action-result"></div>
      </div>`;
    }
    // shell
    return `
    <div class="card">
      <div class="shell-out" id="shell-out">HidenCloud remote shell — ${detail.client.name}\nType a command and press enter. Type "help" for available commands.\n</div>
      <form id="shell-form" class="shell-form">
        <span class="prompt">C:\\&gt;</span>
        <input id="shell-in" autocomplete="off" spellcheck="false" />
      </form>
    </div>`;
}
function fileRow(f) {
    const acts = [];
    if (f.type === "folder")
        acts.push(`<button class="logout file-open" data-name="${escapeAttr(f.name)}">📂 Open</button>`);
    if (f.type === "file")
        acts.push(`<button class="logout file-download" data-name="${escapeAttr(f.name)}">⬇️ Download</button>`);
    acts.push(`<button class="logout danger-btn file-delete" data-name="${escapeAttr(f.name)}">🗑️ Delete</button>`);
    return `<tr data-name="${escapeAttr(f.name)}"><td>${f.type === "folder" ? "📁" : "📄"} ${escapeHtml(f.name)}</td><td>${f.type}</td><td>${f.size}</td><td>${f.modified}</td><td class="file-actions">${acts.join("")}</td></tr>`;
}
function procRow(p) {
    return `<tr data-pid="${p.pid}" data-name="${escapeAttr(p.name.toLowerCase())}">
    <td class="muted">${p.pid}</td>
    <td><strong>${escapeHtml(p.name)}</strong></td>
    <td>${p.cpu}</td>
    <td>${p.mem}</td>
    <td><span class="badge ${p.status === "running" ? "online" : "idle"}">${p.status}</span></td>
    <td>
      <button class="logout danger-btn kill-proc" data-pid="${p.pid}">Kill</button>
      <button class="logout suspend-proc" data-pid="${p.pid}">${p.status === "suspended" ? "Resume" : "Suspend"}</button>
    </td></tr>`;
}
function keylogRow(k) {
    return `<tr><td class="muted">${escapeHtml(k.ts)}</td><td><span class="group-tag">${escapeHtml(k.window)}</span></td><td><code>${escapeHtml(k.text)}</code></td></tr>`;
}
function clipRow(c) {
    return `<tr><td class="muted">${escapeHtml(c.ts)}</td><td><code class="clip-content">${escapeHtml(c.content)}</code></td><td><button class="logout copy-clip" data-text="${escapeAttr(c.content)}">📋 Copy</button></td></tr>`;
}
// ---------- panel bindings ----------
function bindScreen(root, detail) {
    const clock = root.querySelector("#screen-clock");
    const ts = root.querySelector("#screen-ts");
    const frameCount = root.querySelector("#frame-count");
    const recBadge = root.querySelector("#rec-badge");
    const recTime = root.querySelector("#rec-time");
    const recBtn = root.querySelector("#rec-screen");
    const body = root.querySelector("#screen-body");
    let frames = 0;
    let recording = false;
    let recStart = 0;
    const bodyVariants = [
        ["📄 report.docx", "📊 budget.xlsx", "🔑 passwords.txt", "💰 wallet.dat"],
        ["🖼️ vacation.jpg", "📧 inbox.eml", "🧾 invoice.pdf", "🎮 steam.lnk"],
        ["🌐 chrome_history.db", "📎 attachment.zip", "🔐 keys.gpg", "📱 backup.ab"],
    ];
    const update = () => {
        const now = new Date();
        if (clock)
            clock.textContent = now.toLocaleTimeString();
        if (ts)
            ts.textContent = `Last frame: ${now.toLocaleTimeString()}`;
        frames++;
        if (frameCount)
            frameCount.textContent = `Frames: ${frames}`;
        if (recording && recTime) {
            const s = Math.floor((Date.now() - recStart) / 1000);
            recTime.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
        }
    };
    update();
    const int = window.setInterval(update, 1000);
    const obs = new MutationObserver(() => {
        if (!document.body.contains(root)) {
            window.clearInterval(int);
            obs.disconnect();
        }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    root.querySelector("#refresh-screen")?.addEventListener("click", () => {
        if (body) {
            const v = bodyVariants[Math.floor(Math.random() * bodyVariants.length)];
            body.innerHTML = v.map((x) => `<p>${x}</p>`).join("");
        }
        toast("Screen refreshed", "info");
    });
    root.querySelector("#save-screen")?.addEventListener("click", () => {
        const data = `HidenCloud fake screenshot\nhost=${detail.client.name}\nat=${new Date().toISOString()}\n`;
        downloadBlob(`screenshot-${detail.client.id}-${Date.now()}.txt`, data);
        toast("Screenshot saved", "success");
    });
    recBtn?.addEventListener("click", () => {
        recording = !recording;
        if (recording) {
            recStart = Date.now();
            recBadge.style.display = "flex";
            recBtn.textContent = "⏹ Stop";
        }
        else {
            recBadge.style.display = "none";
            recBtn.textContent = "🎥 Start Recording";
            toast("Recording saved", "success");
        }
    });
}
function bindCamera(root, detail) {
    const recBtn = root.querySelector("#cam-rec");
    const status = root.querySelector("#cam-status");
    let recording = false;
    recBtn?.addEventListener("click", () => {
        recording = !recording;
        recBtn.textContent = recording ? "⏹ Stop" : "● Record";
        if (status)
            status.textContent = recording ? "Recording…" : "Streaming…";
        toast(recording ? "Camera recording started" : "Camera recording saved", recording ? "info" : "success");
    });
    root.querySelector("#cam-snap")?.addEventListener("click", () => {
        downloadBlob(`camera-${detail.client.id}-${Date.now()}.txt`, `HidenCloud fake camera snapshot\n`);
        toast("Camera snapshot saved", "success");
    });
    const sel = root.querySelector("#cam-src");
    const label = root.querySelector("#cam-label");
    sel?.addEventListener("change", () => { if (label)
        label.textContent = sel.value.toLowerCase(); });
}
function bindFiles(root, detail, files, path, reRender) {
    const tbody = root.querySelector("#files-tbody");
    root.querySelector("#file-up")?.addEventListener("click", () => {
        if (path.length > 1) {
            path.pop();
            reRender("files");
        }
    });
    root.querySelector("#file-refresh")?.addEventListener("click", () => {
        toast("File list refreshed", "info");
    });
    root.querySelector("#file-newfolder")?.addEventListener("click", () => {
        const name = prompt("Folder name?");
        if (!name)
            return;
        files.unshift({ name, type: "folder", size: "-", modified: new Date().toISOString().slice(0, 10) });
        tbody.insertAdjacentHTML("afterbegin", fileRow(files[0]));
        wireFileButtons();
        toast(`Folder "${name}" created`, "success");
    });
    root.querySelector("#file-upload")?.addEventListener("click", () => {
        toast("Upload dialog would open here", "info");
    });
    function wireFileButtons() {
        tbody.querySelectorAll(".file-open").forEach((b) => b.addEventListener("click", () => {
            path.push(b.dataset["name"] ?? "");
            reRender("files");
        }));
        tbody.querySelectorAll(".file-download").forEach((b) => b.addEventListener("click", () => {
            const name = b.dataset["name"] ?? "file";
            downloadBlob(name, `HidenCloud simulated download of ${name} from ${detail.client.name}\n`);
            toast(`Downloading ${name}`, "success");
        }));
        tbody.querySelectorAll(".file-delete").forEach((b) => b.addEventListener("click", () => {
            const name = b.dataset["name"] ?? "";
            const idx = files.findIndex((f) => f.name === name);
            if (idx >= 0) {
                files.splice(idx, 1);
                tbody.querySelector(`tr[data-name="${cssEsc(name)}"]`)?.remove();
                toast(`Deleted ${name}`, "warn");
            }
        }));
    }
    wireFileButtons();
}
function bindKeylog(root, detail, entries, reRender) {
    const tbody = root.querySelector("#keylog-tbody");
    const live = root.querySelector("#keylog-live");
    const windows = ["Chrome - Twitter", "Slack", "Notepad", "Terminal", "Chrome - Bank Login", "Discord"];
    const samples = ["totally not a password", "meeting at 3pm", "SELECT * FROM users;", "ls -la /home", "git commit -m 'wip'", "cat /etc/shadow"];
    const now = () => new Date().toTimeString().slice(0, 8);
    let liveInt = 0;
    const startLive = () => {
        liveInt = window.setInterval(() => {
            const k = { ts: now(), window: windows[Math.floor(Math.random() * windows.length)], text: samples[Math.floor(Math.random() * samples.length)] };
            entries.unshift(k);
            tbody.insertAdjacentHTML("afterbegin", keylogRow(k));
        }, 2500);
    };
    const cleanup = new MutationObserver(() => {
        if (!document.body.contains(root)) {
            window.clearInterval(liveInt);
            cleanup.disconnect();
        }
    });
    cleanup.observe(document.body, { childList: true, subtree: true });
    live.addEventListener("change", () => {
        if (live.checked) {
            startLive();
            toast("Live keylog capture on", "info");
        }
        else {
            window.clearInterval(liveInt);
            toast("Live keylog capture off", "info");
        }
    });
    root.querySelector("#keylog-refresh")?.addEventListener("click", () => {
        const k = { ts: now(), window: windows[Math.floor(Math.random() * windows.length)], text: samples[Math.floor(Math.random() * samples.length)] };
        entries.unshift(k);
        tbody.insertAdjacentHTML("afterbegin", keylogRow(k));
    });
    root.querySelector("#keylog-export")?.addEventListener("click", () => {
        downloadBlob(`keylog-${detail.client.id}-${Date.now()}.json`, JSON.stringify(entries, null, 2));
        toast("Keylog exported", "success");
    });
    root.querySelector("#keylog-clear")?.addEventListener("click", () => {
        entries.length = 0;
        reRender("keylogger");
        toast("Keylog cleared", "warn");
    });
}
function bindClipboard(root, entries, reRender) {
    const tbody = root.querySelector("#clip-tbody");
    root.querySelector("#clip-refresh")?.addEventListener("click", () => {
        const samples = ["ssh root@10.0.0.1", "curl https://example.com/pwn.sh", "BEGIN CERTIFICATE", "sk-live-xxxxxxxxxxxxxxxx", "192.168.4.20"];
        const e = { ts: new Date().toTimeString().slice(0, 8), content: samples[Math.floor(Math.random() * samples.length)] };
        entries.unshift(e);
        tbody.insertAdjacentHTML("afterbegin", clipRow(e));
    });
    root.querySelector("#clip-export")?.addEventListener("click", () => {
        downloadBlob(`clipboard-${Date.now()}.json`, JSON.stringify(entries, null, 2));
        toast("Clipboard exported", "success");
    });
    root.querySelector("#clip-clear")?.addEventListener("click", () => {
        entries.length = 0;
        reRender("clipboard");
        toast("Clipboard cleared", "warn");
    });
    const wire = () => {
        tbody.querySelectorAll(".copy-clip").forEach((b) => b.addEventListener("click", async () => {
            const text = b.dataset["text"] ?? "";
            try {
                await navigator.clipboard.writeText(text);
                toast("Copied to clipboard", "success");
            }
            catch {
                toast("Copy failed", "warn");
            }
        }));
    };
    wire();
    new MutationObserver(wire).observe(tbody, { childList: true });
}
function bindProcesses(root, procs, reRender) {
    const tbody = root.querySelector("#proc-tbody");
    const search = root.querySelector("#proc-search");
    const applyFilter = () => {
        const q = (search?.value ?? "").toLowerCase();
        tbody.querySelectorAll("tr").forEach((tr) => {
            const name = tr.dataset["name"] ?? "";
            tr.style.display = !q || name.includes(q) ? "" : "none";
        });
    };
    search?.addEventListener("input", applyFilter);
    const wire = () => {
        tbody.querySelectorAll(".kill-proc").forEach((b) => b.addEventListener("click", () => {
            const pid = Number(b.dataset["pid"]);
            const idx = procs.findIndex((p) => p.pid === pid);
            if (idx >= 0) {
                const name = procs[idx].name;
                procs.splice(idx, 1);
                tbody.querySelector(`tr[data-pid="${pid}"]`)?.remove();
                toast(`Killed ${name} (pid ${pid})`, "warn");
            }
        }));
        tbody.querySelectorAll(".suspend-proc").forEach((b) => b.addEventListener("click", () => {
            const pid = Number(b.dataset["pid"]);
            const p = procs.find((x) => x.pid === pid);
            if (!p)
                return;
            p.status = p.status === "suspended" ? "running" : "suspended";
            reRender("processes");
        }));
    };
    wire();
    root.querySelector("#proc-refresh")?.addEventListener("click", () => {
        procs.forEach((p) => { p.cpu = (Math.random() * 10).toFixed(1) + "%"; });
        reRender("processes");
    });
}
function bindActions(root, detail) {
    const resultEl = root.querySelector("#action-result");
    root.querySelectorAll(".action-card").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const action = btn.dataset["action"] ?? "";
            resultEl.innerHTML = `<div class="action-pending">⏳ Executing "${action}" on ${detail.client.name}...</div>`;
            try {
                const res = await api.sendCommand(detail.client.id, action);
                resultEl.innerHTML = `<div class="action-success">✅ ${res.result}</div>`;
            }
            catch (err) {
                resultEl.innerHTML = `<div class="action-error">❌ ${err instanceof Error ? err.message : "Failed"}</div>`;
            }
        });
    });
}
function bindShell(root, detail) {
    const out = root.querySelector("#shell-out");
    const form = root.querySelector("#shell-form");
    const input = root.querySelector("#shell-in");
    const history = [];
    let histIdx = -1;
    input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (histIdx < history.length - 1)
                histIdx++;
            input.value = history[histIdx] ?? "";
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (histIdx > 0)
                histIdx--;
            else
                histIdx = -1;
            input.value = histIdx >= 0 ? (history[histIdx] ?? "") : "";
        }
    });
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const cmd = input.value.trim();
        if (!cmd)
            return;
        history.unshift(cmd);
        histIdx = -1;
        if (cmd === "cls" || cmd === "clear") {
            out.textContent = `HidenCloud remote shell — ${detail.client.name}\n`;
        }
        else {
            out.textContent += `\nC:\\> ${cmd}\n${fakeShell(cmd)}\n`;
        }
        out.scrollTop = out.scrollHeight;
        input.value = "";
    });
}
function fakeShell(cmd) {
    const c = cmd.toLowerCase();
    if (c === "dir" || c === "ls")
        return " Desktop  Documents  Downloads  AppData  passwords.txt  wallet.dat";
    if (c === "whoami")
        return "desktop-jay\\jay";
    if (c.startsWith("echo "))
        return cmd.slice(5);
    if (c === "help")
        return "Commands: dir, whoami, echo, cls, ipconfig, systeminfo, tasklist, netstat, hostname, date, time, ver, tree";
    if (c === "ipconfig")
        return "IPv4 Address. . . . . . : 192.168.1.42\nSubnet Mask . . . . . . : 255.255.255.0\nDefault Gateway . . . . : 192.168.1.1\nDNS Servers . . . . . . : 8.8.8.8, 8.8.4.4";
    if (c === "systeminfo")
        return "OS Name: Microsoft Windows 11 Pro\nOS Version: 10.0.22631\nSystem Type: x64-based PC\nTotal Physical Memory: 32,768 MB";
    if (c === "tasklist")
        return "PID    Name             CPU    Mem\n4      System           0.1%   12 MB\n124    explorer.exe     1.2%   82 MB\n3200   chrome.exe       8.4%   640 MB";
    if (c === "netstat")
        return "TCP  192.168.1.42:49832  142.250.74.14:443  ESTABLISHED\nTCP  192.168.1.42:50112  162.159.136.232:443  ESTABLISHED";
    if (c === "hostname")
        return "DESKTOP-JAY";
    if (c === "date")
        return new Date().toLocaleDateString();
    if (c === "time")
        return new Date().toLocaleTimeString();
    if (c === "ver")
        return "Microsoft Windows [Version 10.0.22631.4169]";
    if (c === "tree")
        return "C:\\Users\\jay\n├── Desktop\n├── Documents\n│   ├── report.docx\n│   └── budget.xlsx\n├── Downloads\n└── passwords.txt";
    return `'${cmd}' is not recognized as an internal or external command.`;
}
// ---------- helpers ----------
function downloadBlob(name, contents) {
    const blob = new Blob([contents], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function cssEsc(s) {
    return s.replace(/["\\]/g, "\\$&");
}
