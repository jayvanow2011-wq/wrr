import { api } from "./api.js";
export function renderLogin(root, onSuccess) {
    root.innerHTML = `
    <div class="login-wrap">
      <form class="login-card" id="login-form">
        <div class="brand"><span class="dot"></span> HidenCloud</div>
        <p class="login-version">v2.0.0</p>
        <p class="sub">Sign in to your control panel.</p>
        <label for="username">Username</label>
        <input id="username" name="username" autocomplete="username" required placeholder="Enter username" />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required placeholder="Enter password" />
        <p class="error" id="login-error"></p>
        <button class="primary" type="submit" id="login-btn">Sign in</button>
        <p class="login-footer">Press <kbd>Ctrl+K</kbd> after login for command palette</p>
      </form>
    </div>
  `;
    const form = root.querySelector("#login-form");
    const errorEl = root.querySelector("#login-error");
    const btn = root.querySelector("#login-btn");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorEl.textContent = "";
        btn.textContent = "Signing in...";
        btn.disabled = true;
        const username = root.querySelector("#username").value;
        const password = root.querySelector("#password").value;
        try {
            await api.login(username, password);
            onSuccess();
        }
        catch (err) {
            errorEl.textContent = err instanceof Error ? err.message : "Login failed";
            btn.textContent = "Sign in";
            btn.disabled = false;
        }
    });
}
