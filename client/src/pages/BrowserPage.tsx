import { useEffect, useMemo, useRef, useState } from "react";
import * as fs from "../app/api/fs";
import * as auth from "../app/api/auth";
import { useAuth } from "../state/AuthContext";
import { useTransfers } from "../state/TransferQueue";
import TransferPanel from "../components/TransferPanel";
import { connectEvents } from "../app/api/ws";

function joinPath(base: string, name: string) {
    if (!base) return name;
    return `${base.replace(/\/+$/, "")}/${name}`;
}

function fmtBytes(n: number) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtTime(epochSeconds: number) {
    const d = new Date(epochSeconds * 1000);
    return d.toLocaleString();
}

function extOf(name: string) {
    const i = name.lastIndexOf(".");
    return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function isImageExt(ext: string) {
    return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext);
}

function isTextExt(ext: string) {
    return [
        "txt", "md", "json", "csv", "log",
        "py", "js", "ts", "tsx", "jsx",
        "html", "css", "yml", "yaml",
        "c", "cpp", "h", "hpp", "java", "go", "rs",
    ].includes(ext);
}

export default function BrowserPage() {
    const { setAuthed } = useAuth();
    const { queueUpload, queueDownload } = useTransfers();

    const [path, setPath] = useState("");
    const [items, setItems] = useState<fs.FsItem[]>([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // NEW: search + selection + preview
    const [query, setQuery] = useState("");
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [previewKind, setPreviewKind] = useState<"none" | "image" | "text">("none");
    const [previewText, setPreviewText] = useState<string>("");
    const [previewUrl, setPreviewUrl] = useState<string>("");
    const [previewErr, setPreviewErr] = useState<string>("");

    const [dragging, setDragging] = useState(false);

    const byName = useMemo(() => {
        const m = new Map<string, fs.FsItem>();
        for (const it of items) m.set(it.name, it);
        return m;
    }, [items]);

    const selected = useMemo(() => {
        if (!selectedPath) return null;
        return items.find((i) => i.path === selectedPath) ?? null;
    }, [items, selectedPath]);

    const visibleItems = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((it) => it.name.toLowerCase().includes(q));
    }, [items, query]);

    async function refresh() {
        setErr(null);
        setBusy(true);
        try {
            const next = await fs.list(path);
            setItems(next);
            // If selection no longer exists, clear it
            if (selectedPath && !next.some((i) => i.path === selectedPath)) {
                setSelectedPath(null);
            }
        } catch (e: any) {
            setErr(e?.message ?? "Failed to load folder");
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => { refresh(); }, [path]);

    // Realtime refresh via WS
    useEffect(() => {
        const conn = connectEvents((paths) => {
            const prefix = path ? `${path.replace(/\/+$/, "")}/` : "";
            const shouldRefresh = paths.some((p) => {
                if (!p) return true;
                if (!path) return !p.includes("/") || p.startsWith(prefix);
                return p === path || p.startsWith(prefix);
            });
            if (shouldRefresh) refresh();
        });

        return () => conn.close();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path]);

    function startUpload(file: File) {
        const dest = joinPath(path, file.name);
        const existing = byName.get(file.name);

        let overwrite = false;
        let ifMatch: string | undefined = undefined;

        if (existing && !existing.is_dir) {
            overwrite = confirm(`"${file.name}" already exists. Overwrite?`);
            if (!overwrite) return;
            ifMatch = existing.etag;
        }

        queueUpload({ destPath: dest, file, overwrite, ifMatch });
    }

    function onFilesSelected(files: FileList | null) {
        if (!files || files.length === 0) return;
        for (const f of Array.from(files)) startUpload(f);
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

    // NEW: preview loader
    const previewAbort = useRef<AbortController | null>(null);

    useEffect(() => {
        // cleanup previous preview
        setPreviewErr("");
        setPreviewText("");
        setPreviewKind("none");

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl("");
        }

        previewAbort.current?.abort();
        previewAbort.current = null;

        if (!selected || selected.is_dir) return;

        const ext = extOf(selected.name);
        const controller = new AbortController();
        previewAbort.current = controller;

        const MAX_TEXT_BYTES = 1_000_000; // 1MB preview limit

        (async () => {
            try {
                if (isImageExt(ext)) {
                    const blob = await fs.download(selected.path, controller.signal);
                    const url = URL.createObjectURL(blob);
                    setPreviewUrl(url);
                    setPreviewKind("image");
                    return;
                }

                if (isTextExt(ext)) {
                    if (selected.size > MAX_TEXT_BYTES) {
                        setPreviewErr(`Too large to preview (${fmtBytes(selected.size)}). Download to view.`);
                        setPreviewKind("text");
                        return;
                    }

                    const blob = await fs.download(selected.path, controller.signal);
                    const text = await blob.text();

                    // Pretty-print JSON if possible (small files)
                    if (ext === "json") {
                        try {
                            const obj = JSON.parse(text);
                            setPreviewText(JSON.stringify(obj, null, 2));
                        } catch {
                            setPreviewText(text);
                        }
                    } else {
                        setPreviewText(text);
                    }

                    setPreviewKind("text");
                    return;
                }

                setPreviewErr("No preview available for this file type.");
                setPreviewKind("none");
            } catch (e: any) {
                if (e?.name === "AbortError") return;
                setPreviewErr(e?.message ?? "Preview failed");
            }
        })();

        return () => {
            controller.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPath, selected?.etag]);

    return (
        <div
            className="page wide"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                onFilesSelected(e.dataTransfer.files);
            }}
        >
            {dragging && (
                <div className="drop-overlay">
                    <div className="drop-card">Drop files to upload</div>
                </div>
            )}

            <header className="topbar">
                <div className="title">
                    <strong>Waypoint</strong>
                    <span className="muted">/ {path || "(root)"}</span>
                </div>

                <div className="actions">
                    <input
                        className="search"
                        placeholder="Search this folder…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />

                    <button onClick={onMkdir}>New folder</button>

                    <label className="upload">
                        Upload
                        <input
                            type="file"
                            multiple
                            onChange={(e) => {
                                onFilesSelected(e.target.files);
                                e.currentTarget.value = "";
                            }}
                        />
                    </label>

                    <button className="secondary" onClick={onLogout}>Logout</button>
                </div>
            </header>

            {err && <div className="error">{err}</div>}

            <div className="split">
                {/* Left: table */}
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

                        {query && (
                            <button className="secondary" onClick={() => setQuery("")}>
                                Clear search
                            </button>
                        )}
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
                            {visibleItems.map((it) => {
                                const isSel = it.path === selectedPath;
                                return (
                                    <tr
                                        key={it.path || it.name}
                                        className={isSel ? "row-selected" : ""}
                                        onClick={() => setSelectedPath(it.path)}
                                    >
                                        <td>
                                            {it.is_dir ? (
                                                <button
                                                    className="link"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPath(it.path);
                                                        setSelectedPath(null);
                                                    }}
                                                >
                                                    📁 {it.name}
                                                </button>
                                            ) : (
                                                <span>📄 {it.name}</span>
                                            )}
                                        </td>
                                        <td className="right">{it.is_dir ? "-" : fmtBytes(it.size)}</td>
                                        <td className="right" onClick={(e) => e.stopPropagation()}>
                                            {!it.is_dir && (
                                                <button className="secondary" onClick={() => queueDownload(it)}>
                                                    Download
                                                </button>
                                            )}
                                            <button className="secondary" onClick={() => onRename(it)}>Rename</button>
                                            <button className="danger" onClick={() => onDelete(it)}>Delete</button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {visibleItems.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="muted">No matches</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Right: preview pane */}
                <div className="card preview">
                    <div className="preview-head">
                        <strong>Preview</strong>
                        {selected?.path && (
                            <button
                                className="secondary"
                                onClick={() => navigator.clipboard.writeText(selected.path)}
                            >
                                Copy path
                            </button>
                        )}
                    </div>

                    {!selected && <div className="muted">Select a file to preview.</div>}

                    {selected && (
                        <>
                            <div className="kv">
                                <div className="k">Name</div>
                                <div className="v">{selected.name}</div>

                                <div className="k">Path</div>
                                <div className="v mono">{selected.path || "(root)"}</div>

                                <div className="k">Type</div>
                                <div className="v">{selected.is_dir ? "Folder" : "File"}</div>

                                {!selected.is_dir && (
                                    <>
                                        <div className="k">Size</div>
                                        <div className="v">{fmtBytes(selected.size)}</div>
                                    </>
                                )}

                                <div className="k">Modified</div>
                                <div className="v">{fmtTime(selected.mtime)}</div>
                            </div>

                            {previewErr && <div className="error">{previewErr}</div>}

                            {previewKind === "image" && previewUrl && (
                                <div className="img-wrap">
                                    <img src={previewUrl} alt={selected.name} />
                                </div>
                            )}

                            {previewKind === "text" && (
                                <pre className="code">{previewText || ""}</pre>
                            )}

                            {!selected.is_dir && (
                                <div className="preview-actions">
                                    <button className="secondary" onClick={() => queueDownload(selected)}>
                                        Download
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <TransferPanel />
        </div>
    );
}