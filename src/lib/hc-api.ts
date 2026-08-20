function getCsrf(): string {
  const m = document.cookie.match(/(?:^|;\s*)hc_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1] ?? "") : "";
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrf() },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const hcApi = {
  async me(): Promise<{ ok: boolean; user?: string; userId?: number; csrf?: string }> {
    const res = await fetch("/api/me");
    if (!res.ok) return { ok: false };
    return res.json();
  },
  login(username: string, password: string) {
    return post<{ ok: true; user: string; userId: number; csrf: string }>("/api/login", { username, password });
  },
  logout() {
    return post<{ ok: true }>("/api/logout");
  },
  async stats(): Promise<any> {
    const res = await fetch("/api/stats");
    if (!res.ok) throw new Error("Not authorized");
    return res.json();
  },
  async client(id: string): Promise<any> {
    const res = await fetch(`/api/client/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Client not found");
    return res.json();
  },
  async logs(): Promise<any[]> {
    const res = await fetch("/api/logs");
    if (!res.ok) throw new Error("Not authorized");
    const data = await res.json();
    return data.logs;
  },
  clearLogs() {
    return post<{ ok: true }>("/api/logs");
  },
  sendCommand(clientId: string, action: string, shell?: string) {
    return post<{ ok: true; result: string }>(`/api/command/${encodeURIComponent(clientId)}`, { action, shell });
  },
  build(cfg: any) {
    return post<any>("/api/build", cfg);
  },
  async settings(): Promise<{ ok: boolean; webhookUrl: string }> {
    const res = await fetch("/api/settings");
    if (!res.ok) throw new Error("Not authorized");
    return res.json();
  },
  saveSettings(data: { webhookUrl: string }) {
    return post<{ ok: true }>("/api/settings", data);
  },
  testWebhook() {
    return post<{ ok: true }>("/api/settings/test-webhook");
  },
  async builds(): Promise<any[]> {
    const res = await fetch("/api/builds");
    if (!res.ok) throw new Error("Not authorized");
    const data = await res.json();
    return data.builds;
  },
};
