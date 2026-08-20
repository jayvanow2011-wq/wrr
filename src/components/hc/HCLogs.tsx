import { useEffect, useState } from "react";
import { hcApi } from "@/lib/hc-api";

export function HCLogs() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    hcApi.logs().then(setLogs).catch(() => {});
  }, []);

  return (
    <div>
      <h1>Logs</h1>
      <p className="hc-sub">System event log.</p>
      <div className="hc-card">
        <button className="hc-connect-btn" style={{ marginBottom: 12 }} onClick={async () => {
          await hcApi.clearLogs();
          const l = await hcApi.logs();
          setLogs(l);
        }}>Clear Logs</button>
        <div className="hc-log-list">
          {logs.map(l => (
            <div key={l.id} className={`hc-log-row hc-log-${l.type}`}>
              <span className="hc-log-badge">{l.type.toUpperCase()}</span>
              <span className="hc-log-msg">{l.msg}</span>
              <span className="hc-muted">{new Date(l.ts).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
