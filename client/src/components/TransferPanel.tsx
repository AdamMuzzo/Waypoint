import { useTransfers } from "../state/TransferQueue";

function pct(loaded: number, total: number | null) {
    if (!total || total <= 0) return null;
    return Math.min(100, Math.round((loaded / total) * 100));
}

export default function TransferPanel() {
    const { transfers, cancel, clearFinished } = useTransfers();
    if (transfers.length === 0) return null;

    return (
        <div className="transfer-panel">
            <div className="transfer-head">
                <strong>Transfers</strong>
                <button className="secondary" onClick={clearFinished}>Clear finished</button>
            </div>

            <div className="transfer-list">
                {transfers.map((t) => {
                    const p = pct(t.loaded, t.total);
                    return (
                        <div key={t.id} className="transfer-item">
                            <div className="transfer-row">
                                <div className="transfer-title">
                                    <span className="badge">{t.kind}</span> {t.filename}
                                </div>

                                {(t.status === "running" || t.status === "queued") ? (
                                    <button className="secondary" onClick={() => cancel(t.id)}>Cancel</button>
                                ) : (
                                    <span className={`status ${t.status}`}>{t.status}</span>
                                )}
                            </div>

                            <progress value={t.total ? t.loaded : undefined} max={t.total ?? 1}></progress>

                            <div className="transfer-meta">
                                {p !== null ? <span>{p}%</span> : <span className="muted">…</span>}
                                {t.error ? <span className="error-text">{t.error}</span> : <span className="muted">{t.path}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
