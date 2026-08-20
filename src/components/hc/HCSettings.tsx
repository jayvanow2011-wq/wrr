import { useState, useEffect } from "react";
import { hcApi } from "@/lib/hc-api";

export function HCSettings() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    hcApi.settings().then(s => setWebhookUrl(s.webhookUrl || "")).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      await hcApi.saveSettings({ webhookUrl });
      setMsg("Settings saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
    setSaving(false);
  }

  async function test() {
    setTesting(true);
    setMsg("");
    try {
      await hcApi.testWebhook();
      setMsg("Webhook sent! Check your Discord.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Webhook failed");
    }
    setTesting(false);
  }

  return (
    <div>
      <h1>Settings</h1>
      <p className="hc-sub">Configure notifications and integrations.</p>

      <div className="hc-card" style={{ maxWidth: 520 }}>
        <h3 className="hc-section-title">Discord Webhook</h3>
        <p className="hc-muted" style={{ marginBottom: 12, fontSize: 12 }}>
          Get notified when a new client connects, builds are created, and more. Paste your Discord webhook URL below.
        </p>
        <label>Webhook URL</label>
        <input
          value={webhookUrl}
          onChange={e => setWebhookUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="hc-primary" onClick={save} disabled={saving} style={{ flex: 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            className="hc-connect-btn"
            onClick={test}
            disabled={testing || !webhookUrl}
            style={{ padding: "10px 16px" }}
          >
            {testing ? "Sending…" : "Test Webhook"}
          </button>
        </div>
        {msg && <div className="hc-muted" style={{ marginTop: 10, fontSize: 12 }}>{msg}</div>}
      </div>

      <div className="hc-card" style={{ maxWidth: 520, marginTop: 12 }}>
        <h3 className="hc-section-title">Webhook Events</h3>
        <div className="hc-info-row"><span>🟢 New client connected</span><span className="hc-muted">@everyone ping</span></div>
        <div className="hc-info-row"><span>🔨 Build created</span><span className="hc-muted">Build details embed</span></div>
        <div className="hc-info-row"><span>⚠️ Client went offline</span><span className="hc-muted">Status change alert</span></div>
        <div className="hc-info-row"><span>🔐 Login attempt</span><span className="hc-muted">Security alert</span></div>
      </div>
    </div>
  );
}
