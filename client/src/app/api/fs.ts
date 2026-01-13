import { apiFetch } from "./http";

export type FsItem = {
    path: string;
    name: string;
    is_dir: boolean;
    size: number;
    mtime: number;
    etag?: string;
};

export async function list(path: string): Promise<FsItem[]> {
    const q = new URLSearchParams({ path });
    const res = await apiFetch(`/fs/list?${q.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.items as FsItem[];
}

export async function mkdir(path: string) {
    const q = new URLSearchParams({ path, parents: "true" });
    const res = await apiFetch(`/fs/mkdir?${q.toString()}`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
}

export async function move(src: string, dst: string, overwrite = false) {
    const q = new URLSearchParams({ src, dst, overwrite: String(overwrite) });
    const res = await apiFetch(`/fs/move?${q.toString()}`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
}

export async function del(path: string, recursive = false) {
    const q = new URLSearchParams({ path, recursive: String(recursive) });
    const res = await apiFetch(`/fs/delete?${q.toString()}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
}

export async function upload(path: string, file: File, overwrite = false, ifMatch?: string) {
    const q = new URLSearchParams({ path, overwrite: String(overwrite) });
    const form = new FormData();
    form.append("file", file);

    const headers: Record<string, string> = {};
    if (ifMatch) headers["If-Match"] = ifMatch;

    const res = await apiFetch(`/fs/upload?${q.toString()}`, {
        method: "POST",
        body: form,
        headers,
    });

    if (res.status === 412) throw new Error("File changed on server (ETag mismatch)");
    if (!res.ok) throw new Error(await res.text());
}

export async function download(path: string): Promise<Blob> {
    const q = new URLSearchParams({ path });
    const res = await apiFetch(`/fs/download?${q.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.blob();
}