import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import BrowserPage from "./pages/BrowserPage";
import { useAuth } from "./state/AuthContext";
import type { ReactNode } from "react";

function Protected({ children }: { children: ReactNode }) {
  const { authed } = useAuth();
  return authed ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const { authed } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={authed ? "/browse" : "/login"} replace />}
        />

        <Route
          path="/login"
          element={authed ? <Navigate to="/browse" replace /> : <LoginPage />}
        />

        <Route
          path="/browse"
          element={
            <Protected>
              <BrowserPage />
            </Protected>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}