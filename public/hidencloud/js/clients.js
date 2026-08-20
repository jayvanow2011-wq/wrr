export function renderClients(data) {
    const rows = data.clients
        .map((c) => `
        <tr class="client-row" data-status="${c.status}" data-group="${c.group}" data-search="${(c.name + c.user + c.id + c.ip + c.os + c.country).toLowerCase()}">
          <td><input type="checkbox" class="client-check" data-id="${c.id}" /></td>
          <td><code class="client-id">${c.id}</code></td>
          <td>
            <div class="client-name-cell">
              <strong>${c.name}</strong>
              <span class="muted">${c.user}@${c.ip}</span>
            </div>
          </td>
          <td>${c.os}</td>
          <td><span class="flag">${flagEmoji(c.countryCode)}</span> ${c.country}</td>
          <td><span class="badge ${c.status}"><i class="pulse"></i>${c.status}</span></td>
          <td class="muted">${c.lastSeen}</td>
          <td><span class="group-tag">${c.group}</span></td>
          <td>
            <div class="action-btns">
              <button class="primary connect-btn" data-id="${c.id}" ${c.status === "offline" ? "disabled" : ""}>Connect</button>
              <button class="icon-btn ping-btn" data-id="${c.id}" title="Ping">📡</button>
              <button class="icon-btn uninstall-btn" data-id="${c.id}" title="Uninstall">🗑️</button>
            </div>
          </td>
        </tr>`)
        .join("");
    return `
    <h1>Clients</h1>
    <p class="page-sub">${data.clients.length} client${data.clients.length === 1 ? "" : "s"} registered. Click Connect to open Admin Control.</p>
    
    <div class="client-toolbar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="client-search" placeholder="Search clients..." />
      </div>
      <div class="filter-group">
        <select id="status-filter">
          <option value="all">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="idle">Idle</option>
        </select>
        <select id="group-filter">
          <option value="all">All Groups</option>
          <option value="Personal">Personal</option>
          <option value="Work">Work</option>
          <option value="Servers">Servers</option>
        </select>
      </div>
      <div class="bulk-actions">
        <button class="logout" id="bulk-screenshot">📸 Mass Screenshot</button>
        <button class="logout" id="bulk-update">🔄 Update All</button>
        <button class="logout danger-btn" id="bulk-shutdown">⛔ Shutdown Selected</button>
      </div>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" id="select-all" /></th>
            <th>ID</th>
            <th>Host / User</th>
            <th>OS</th>
            <th>Country</th>
            <th>Status</th>
            <th>Last Seen</th>
            <th>Group</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="client-tbody">${rows}</tbody>
      </table>
      <div class="table-footer">
        <span class="muted" id="client-count">Showing ${data.clients.length} of ${data.clients.length}</span>
      </div>
    </div>
  `;
}
function flagEmoji(code) {
    return code.replace(/./g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}
export function bindClients(root) {
    const search = root.querySelector("#client-search");
    const statusFilter = root.querySelector("#status-filter");
    const groupFilter = root.querySelector("#group-filter");
    const selectAll = root.querySelector("#select-all");
    const rows = root.querySelectorAll(".client-row");
    const countEl = root.querySelector("#client-count");
    function filter() {
        const q = (search?.value ?? "").toLowerCase();
        const status = statusFilter?.value ?? "all";
        const group = groupFilter?.value ?? "all";
        let visible = 0;
        rows.forEach((r) => {
            const matchSearch = !q || (r.dataset["search"] ?? "").includes(q);
            const matchStatus = status === "all" || r.dataset["status"] === status;
            const matchGroup = group === "all" || r.dataset["group"] === group;
            const show = matchSearch && matchStatus && matchGroup;
            r.style.display = show ? "" : "none";
            if (show)
                visible++;
        });
        if (countEl)
            countEl.textContent = `Showing ${visible} of ${rows.length}`;
    }
    search?.addEventListener("input", filter);
    statusFilter?.addEventListener("change", filter);
    groupFilter?.addEventListener("change", filter);
    selectAll?.addEventListener("change", () => {
        root.querySelectorAll(".client-check").forEach((cb) => {
            cb.checked = selectAll.checked;
        });
    });
    root.querySelectorAll(".ping-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            showToast(`Ping sent to ${btn.dataset["id"]}`, "info");
        });
    });
    root.querySelectorAll(".uninstall-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            showToast(`Uninstall queued for ${btn.dataset["id"]}`, "warn");
        });
    });
    root.querySelector("#bulk-screenshot")?.addEventListener("click", () => {
        showToast("Mass screenshot command sent to all online clients", "success");
    });
    root.querySelector("#bulk-update")?.addEventListener("click", () => {
        showToast("Update command queued for all clients", "info");
    });
    root.querySelector("#bulk-shutdown")?.addEventListener("click", () => {
        const checked = root.querySelectorAll(".client-check:checked");
        if (checked.length === 0) {
            showToast("No clients selected", "warn");
        }
        else {
            showToast(`Shutdown sent to ${checked.length} client(s)`, "warn");
        }
    });
}
function showToast(msg, type) {
    const existing = document.querySelectorAll(".toast");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    toast.style.bottom = `${20 + existing.length * 56}px`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
