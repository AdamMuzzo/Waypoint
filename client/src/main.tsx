import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./state/AuthContext";
import { TransferProvider } from "./state/TransferQueue";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <TransferProvider>
        <App />
      </TransferProvider>
    </AuthProvider>
  </React.StrictMode>
);