function getCsrf() {
    const m = document.cookie.match(/(?:^|;\s*)hc_csrf=([^;]+)/);
    return m ? decodeURIComponent(m[1] ?? "") : "";
}
async function post(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrf() },
        body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json());
    if (!res.ok)
        throw new Error(data.error || "Request failed");
    return data;
}
export const api = {
    async me() {
        const res = await fetch("/api/me");
        return res.ok;
    },
    login(username, password) {
        return post("/api/login", { username, password });
    },
    logout() {
        return post("/api/logout");
    },
    async stats() {
        const res = await fetch("/api/stats");
        if (!res.ok)
            throw new Error("Not authorized");
        return (await res.json());
    },
    async client(id) {
        const res = await fetch(`/api/client/${encodeURIComponent(id)}`);
        if (!res.ok)
            throw new Error("Client not found");
        return (await res.json());
    },
    async logs() {
        const res = await fetch("/api/logs");
        if (!res.ok)
            throw new Error("Not authorized");
        const data = (await res.json());
        return data.logs;
    },
    clearLogs() {
        return post("/api/logs");
    },
    sendCommand(clientId, action) {
        return post(`/api/command/${encodeURIComponent(clientId)}`, { action });
    },
    build(cfg) {
        return post("/api/build", cfg);
    },
};
