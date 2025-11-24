import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register a service worker for PWA/offline support (web only)
// Only register on web with HTTPS or localhost
// Skip registration on native platforms (Capacitor Android/iOS)
// where file:// protocol doesn't support service workers
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const shouldRegisterSW =
      (window.location.protocol === "https:" || window.location.hostname === "localhost") &&
      !window.location.protocol.startsWith("file");

    if (shouldRegisterSW) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          // Service worker registered successfully
        })
        .catch((err) => {
          console.error("ServiceWorker registration failed: ", err);
        });
    }
  });
}
