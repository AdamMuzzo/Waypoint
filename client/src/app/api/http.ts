const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export type Tokens = {
    access_token: string;
    refresh_token: string;
    expires_in: number; // seconds
    acquired_at: number; // ms epoch
};

const LS_KEY = "waypoint.tokens.v1";

export function loadTokens(): Tokens | null {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as Tokens;
    } catch {
        return null;
    }
}

export function saveTokens(t: Omit<Tokens, "acquired_at">): Tokens {
    const full: Tokens = { ...t, acquired_at: Date.now() };
    localStorage.setItem(LS_KEY, JSON.stringify(full));
    return full;
}

export function clearTokens() {
    localStorage.removeItem(LS_KEY);
}

async function refreshTokens(refresh_token: string): Promise<Tokens> {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token }),
    });

    if (!res.ok) throw new Error("refresh failed");
    const data = await res.json();
    return saveTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
    });
}

export async function apiFetch(
    path: string,
    init: RequestInit = {},
    opts: { auth?: boolean; retry?: boolean } = { auth: true, retry: true }
): Promise<Response> {
    const headers = new Headers(init.headers ?? {});
    if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    if (opts.auth) {
        const tokens = loadTokens();
        if (tokens?.access_token) headers.set("Authorization", `Bearer ${tokens.access_token}`);
    }

    const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

    // If access token expired, try refresh once and retry the request
    if (res.status === 401 && opts.auth && opts.retry) {
        const tokens = loadTokens();
        if (tokens?.refresh_token) {
            try {
                await refreshTokens(tokens.refresh_token);

                const headers2 = new Headers(init.headers ?? {});
                const tokens2 = loadTokens();
                if (tokens2?.access_token) headers2.set("Authorization", `Bearer ${tokens2.access_token}`);
                if (!headers2.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
                    headers2.set("Content-Type", "application/json");
                }

                return fetch(`${API_BASE}${path}`, { ...init, headers: headers2 });
            } catch {
                // refresh failed -> clear session
                clearTokens();
            }
        }
    }

    return res;
}

export function apiUrl(path: string) {
    return `${API_BASE}${path}`;
}