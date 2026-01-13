import React, { createContext, useContext, useMemo, useState } from "react";
import { loadTokens } from "../app/api/http";

type AuthCtx = {
    authed: boolean;
    setAuthed: (v: boolean) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [authed, setAuthed] = useState<boolean>(() => !!loadTokens());
    const value = useMemo(() => ({ authed, setAuthed }), [authed]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
    const v = useContext(Ctx);
    if (!v) throw new Error("AuthProvider missing");
    return v;
}