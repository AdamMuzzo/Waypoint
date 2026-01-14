import { apiFetch, apiUrl, loadTokens, saveTokens } from "./http";

async function ensureAccessToken(): Promise<string | null> {
    const t = loadTokens();
    if (!t) return null;

    const expiresAt = t.acquired_at + t.expires_in * 1000;
    const safetyWindowMs = 30_000;

    if (Date.now() < expiresAt - safetyWindowMs) return t.access_token;

    const res = await fetch(apiUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: t.refresh_token }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const refreshed = saveTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
    });

    return refreshed.access_token;
}

export function saveBlobAs(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function uploadWithProgress(opts: {
    path: string;
    file: File;
    overwrite?: boolean;
    ifMatch?: string;
    onProgress?: (loaded: number, total: number | null) => void;
}): { cancel: () => void; promise: Promise<void> } {
    const { path, file, overwrite = false, ifMatch, onProgress } = opts;
    const controller = new AbortController();

    const promise = (async () => {
        const token = await ensureAccessToken();
        if (!token) throw new Error("Not authenticated");

        const q = new URLSearchParams({ path, overwrite: String(overwrite) });
        const url = apiUrl(`/fs/upload?${q.toString()}`);

        const form = new FormData();
        form.append("file", file);

        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", url, true);
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
            if (ifMatch) xhr.setRequestHeader("If-Match", ifMatch);

            xhr.upload.onprogress = (e) => {
                onProgress?.(e.loaded, e.lengthComputable ? e.total : null);
            };

            xhr.onerror = () => reject(new Error("Network error"));
            xhr.onabort = () => reject(new Error("Canceled"));

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) return resolve();
                if (xhr.status === 412) return reject(new Error("File changed on server (ETag mismatch)"));
                reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
            };

            controller.signal.addEventListener("abort", () => xhr.abort(), { once: true });
            xhr.send(form);
        });
    })();

    return { cancel: () => controller.abort(), promise };
}

export function downloadWithProgress(opts: {
    path: string;
    filename: string;
    onProgress?: (loaded: number, total: number | null) => void;
}): { cancel: () => void; promise: Promise<void> } {
    const { path, filename, onProgress } = opts;
    const controller = new AbortController();

    const promise = (async () => {
        const q = new URLSearchParams({ path });

        const res = await apiFetch(`/fs/download?${q.toString()}`, {
            method: "GET",
            signal: controller.signal,
        });

        if (!res.ok) throw new Error(await res.text());

        const totalHeader = res.headers.get("Content-Length");
        const total = totalHeader ? Number(totalHeader) : null;

        const reader = res.body?.getReader();
        if (!reader) {
            const blob = await res.blob();
            saveBlobAs(blob, filename);
            return;
        }

        const chunks: BlobPart[] = [];
        let loaded = 0;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
                chunks.push(value);
                loaded += value.byteLength;
                onProgress?.(loaded, total);
            }
        }

        const blob = new Blob(chunks, { type: "application/octet-stream" });
        saveBlobAs(blob, filename);
    })();

    return { cancel: () => controller.abort(), promise };
}
