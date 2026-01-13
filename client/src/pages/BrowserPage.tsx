import { useEffect, useMemo, useState } from "react";
import * as fs from "../app/api/fs";
import * as auth from "../app/api/auth";
import { useAuth } from "../state/AuthContext";

function joinPath(base: string, name: string) {
    if (!base) return name;
    return `${base.replace(/\/+$/, "")}/${name}`;
}

export default function BrowserPage() {
    const { setAuthed } = useAuth();
    const [path, setPath] = useState("");
    const [items, setItems] = useState<fs.FsItem[]>([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const byName = useMemo(() => {
        const m = new Map<string, fs.FsItem>();
        for (const it of items) m.set(it.name, it);
        return m;
    }, [items]);

    async function refresh() {
        setErr(null);
        setBusy(true);
        try {
            setItems(await fs.list(path));
        } catch (e: any) {
            setErr(e?.message ?? "Failed to load folder");
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => { refresh(); }, [path]);

    async function onUpload(file: File) {
        const dest = joinPath(path, file.name);
        const existing = byName.get(file.name);

        let overwrite = false;
        let ifMatch: string | undefined = undefined;

        if (existing && !existing.is_dir) {
            overwrite = confirm(`"${file.name}" already exists. Overwrite?`);
            if (!overwrite) return;
            ifMatch = existing.etag; // prevents overwrite if it changed since list
        }

        try {
            await fs.upload(dest, file, overwrite, ifMatch);
            await refresh();
        } catch (e: any) {
            alert(e?.message ?? "Upload failed");
        }
    }

    async function onDownload(it: fs.FsItem) {
        try {
            const blob = await fs.download(it.path);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = it.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            alert(e?.message ?? "Download failed");
        }
    }

    async function onMkdir() {
        const name = prompt("New folder name:");
        if (!name) return;
        try {
            await fs.mkdir(joinPath(path, name));
            await refresh();
        } catch (e: any) {
            alert(e?.message ?? "mkdir failed");
        }
    }

    async function onRename(it: fs.FsItem) {
        const name = prompt("Rename to:", it.name);
        if (!name || name === it.name) return;
        const dst = joinPath(path, name);
        try {
            await fs.move(it.path, dst, false);
            await refresh();
        } catch (e: any) {
            alert(e?.message ?? "rename failed");
        }
    }

    async function onDelete(it: fs.FsItem) {
        const ok = confirm(`Delete ${it.is_dir ? "folder" : "file"} "${it.name}"?`);
        if (!ok) return;

        const recursive = it.is_dir ? confirm("Recursive delete? (OK = recursive)") : false;

        try {
            await fs.del(it.path, recursive);
            await refresh();
        } catch (e: any) {
            alert(e?.message ?? "delete failed");
        }
    }

    async function onLogout() {
        await auth.logout();
        setAuthed(false);
    }

    return (
        <div className="page wide">
            <header className="topbar">
                <div className="title">
                    <strong>Waypoint</strong>
                    <span className="muted">/ {path || "(root)"}</span>
                </div>

                <div className="actions">
                    <button onClick={onMkdir}>New folder</button>
                    <label className="upload">
                        Upload
                        <input
                            type="file"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) onUpload(f);
                                e.currentTarget.value = "";
                            }}
                        />
                    </label>
                    <button className="secondary" onClick={onLogout}>Logout</button>
                </div>
            </header>

            {err && <div className="error">{err}</div>}

            <div className="card">
                <div className="crumbs">
                    <button
                        className="secondary"
                        disabled={!path}
                        onClick={() => setPath(path.split("/").slice(0, -1).join("/"))}
                    >
                        Up
                    </button>
                    <button className="secondary" onClick={refresh} disabled={busy}>
                        {busy ? "Refreshing..." : "Refresh"}
                    </button>
                </div>

                <table className="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th className="right">Size</th>
                            <th className="right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.path || it.name}>
                                <td>
                                    {it.is_dir ? (
                                        <button className="link" onClick={() => setPath(it.path)}>
                                            📁 {it.name}
                                        </button>
                                    ) : (
                                        <span>📄 {it.name}</span>
                                    )}
                                </td>
                                <td className="right">{it.is_dir ? "-" : it.size}</td>
                                <td className="right">
                                    {!it.is_dir && (
                                        <button className="secondary" onClick={() => onDownload(it)}>
                                            Download
                                        </button>
                                    )}
                                    <button className="secondary" onClick={() => onRename(it)}>Rename</button>
                                    <button className="danger" onClick={() => onDelete(it)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={3} className="muted">Empty folder</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}