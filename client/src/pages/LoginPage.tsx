import { useState } from "react";
import * as auth from "../app/api/auth";
import { useAuth } from "../state/AuthContext";

export default function LoginPage() {
    const { setAuthed } = useAuth();
    const [username, setUsername] = useState("adam");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        setBusy(true);
        try {
            await auth.login(username, password);
            setAuthed(true);
        } catch (e: any) {
            setErr(e?.message ?? "Login failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="page">
            <div className="card">
                <h1>Waypoint</h1>
                <p className="muted">Sign in to your home server.</p>

                <form onSubmit={onSubmit} className="stack">
                    <label>
                        Username
                        <input value={username} onChange={(e) => setUsername(e.target.value)} />
                    </label>

                    <label>
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </label>

                    {err && <div className="error">{err}</div>}

                    <button disabled={busy || !username || !password}>
                        {busy ? "Signing in..." : "Sign in"}
                    </button>
                </form>
            </div>
        </div>
    );
}