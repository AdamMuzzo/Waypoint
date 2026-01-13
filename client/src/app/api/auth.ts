import { apiFetch, saveTokens, clearTokens } from "./http";

export async function login(username: string, password: string) {
    const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
    }, { auth: false });

    if (!res.ok) throw new Error("Invalid credentials");
    const data = await res.json();
    saveTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
    });
}

export async function logout() {
    // best-effort server logout, then clear locally
    try {
        await apiFetch("/auth/logout", { method: "POST" });
    } finally {
        clearTokens();
    }
}