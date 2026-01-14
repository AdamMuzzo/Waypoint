import { apiUrl, loadTokens } from "./http";

export function connectEvents(onEvents: (paths: string[]) => void) {
    const tokens = loadTokens();
    if (!tokens?.access_token) throw new Error("Not authenticated");

    const httpBase = apiUrl("");
    const wsBase = httpBase.replace(/^http/, "ws");
    const url = `${wsBase}/events?token=${encodeURIComponent(tokens.access_token)}`;

    let ws: WebSocket | null = new WebSocket(url);

    ws.onmessage = (msg) => {
        try {
            const data = JSON.parse(msg.data);
            const paths = (data?.events ?? [])
                .map((e: any) => e?.path)
                .filter((p: any) => typeof p === "string");
            if (paths.length) onEvents(paths);
        } catch {
            // ignore
        }
    };

    ws.onclose = () => {
        // caller can reconnect if desired
    };

    return {
        close: () => ws?.close(),
    };
}