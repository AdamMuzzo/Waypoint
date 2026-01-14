import React, { createContext, useContext, useMemo, useReducer, useRef } from "react";
import { downloadWithProgress, uploadWithProgress } from "../app/api/transfers.ts";
import type { FsItem } from "../app/api/fs";

export type TransferKind = "upload" | "download";
export type TransferStatus = "queued" | "running" | "done" | "error" | "canceled";

export type Transfer = {
    id: string;
    kind: TransferKind;
    path: string;
    filename: string;
    status: TransferStatus;
    loaded: number;
    total: number | null;
    error?: string;
};

type State = { transfers: Transfer[] };

type Action =
    | { type: "ADD"; t: Transfer }
    | { type: "STATUS"; id: string; status: TransferStatus; error?: string }
    | { type: "PROGRESS"; id: string; loaded: number; total: number | null }
    | { type: "CLEAR_FINISHED" };

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case "ADD":
            return { transfers: [action.t, ...state.transfers] };
        case "STATUS":
            return {
                transfers: state.transfers.map((t) =>
                    t.id === action.id ? { ...t, status: action.status, error: action.error } : t
                ),
            };
        case "PROGRESS":
            return {
                transfers: state.transfers.map((t) =>
                    t.id === action.id ? { ...t, loaded: action.loaded, total: action.total } : t
                ),
            };
        case "CLEAR_FINISHED":
            return {
                transfers: state.transfers.filter((t) => t.status === "running" || t.status === "queued"),
            };
        default:
            return state;
    }
}

function uid() {
    return (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type Ctx = {
    transfers: Transfer[];
    queueUpload: (opts: {
        destPath: string;
        file: File;
        overwrite?: boolean;
        ifMatch?: string;
    }) => void;
    queueDownload: (item: FsItem) => void;
    cancel: (id: string) => void;
    clearFinished: () => void;
};

const TransferCtx = createContext<Ctx | null>(null);

export function TransferProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(reducer, { transfers: [] });
    const cancelMap = useRef(new Map<string, () => void>());

    const api: Ctx = useMemo(() => {
        const cancel = (id: string) => {
            const fn = cancelMap.current.get(id);
            if (fn) fn();
            cancelMap.current.delete(id);
            dispatch({ type: "STATUS", id, status: "canceled" });
        };

        const clearFinished = () => dispatch({ type: "CLEAR_FINISHED" });

        const queueUpload: Ctx["queueUpload"] = ({ destPath, file, overwrite, ifMatch }) => {
            const id = uid();
            dispatch({
                type: "ADD",
                t: {
                    id,
                    kind: "upload",
                    path: destPath,
                    filename: file.name,
                    status: "queued",
                    loaded: 0,
                    total: file.size ?? null,
                },
            });

            dispatch({ type: "STATUS", id, status: "running" });

            const job = uploadWithProgress({
                path: destPath,
                file,
                overwrite: !!overwrite,
                ifMatch,
                onProgress: (loaded, total) => dispatch({ type: "PROGRESS", id, loaded, total }),
            });

            cancelMap.current.set(id, job.cancel);

            job.promise
                .then(() => dispatch({ type: "STATUS", id, status: "done" }))
                .catch((e: any) => {
                    const msg = e?.message ?? "Upload failed";
                    dispatch({
                        type: "STATUS",
                        id,
                        status: msg === "Canceled" ? "canceled" : "error",
                        error: msg,
                    });
                })
                .finally(() => cancelMap.current.delete(id));
        };

        const queueDownload: Ctx["queueDownload"] = (item) => {
            const id = uid();
            dispatch({
                type: "ADD",
                t: {
                    id,
                    kind: "download",
                    path: item.path,
                    filename: item.name,
                    status: "queued",
                    loaded: 0,
                    total: null,
                },
            });

            dispatch({ type: "STATUS", id, status: "running" });

            const job = downloadWithProgress({
                path: item.path,
                filename: item.name,
                onProgress: (loaded, total) => dispatch({ type: "PROGRESS", id, loaded, total }),
            });

            cancelMap.current.set(id, job.cancel);

            job.promise
                .then(() => dispatch({ type: "STATUS", id, status: "done" }))
                .catch((e: any) => {
                    const msg = e?.message ?? "Download failed";
                    dispatch({
                        type: "STATUS",
                        id,
                        status: msg === "Canceled" ? "canceled" : "error",
                        error: msg,
                    });
                })
                .finally(() => cancelMap.current.delete(id));
        };

        return { transfers: state.transfers, queueUpload, queueDownload, cancel, clearFinished };
    }, [state.transfers]);

    return <TransferCtx.Provider value={api}>{children}</TransferCtx.Provider>;
}

export function useTransfers() {
    const v = useContext(TransferCtx);
    if (!v) throw new Error("TransferProvider missing");
    return v;
}
