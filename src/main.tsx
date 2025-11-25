import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global error handlers
window.addEventListener('error', (event) => {
  console.error('[Global Error Handler]', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
  // Don't prevent default - let browser handle it, but we're logging it
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("Root element not found!");
  document.body.innerHTML = "<div style='padding: 20px; color: red;'>Error: Root element not found in DOM</div>";
} else {
  try {
    console.log("Mounting React app...");
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    console.log("React app mounted successfully");
  } catch (error) {
    console.error("Failed to mount React app:", error);
    document.body.innerHTML = `<div style='padding: 20px; color: red; font-family: monospace;'>Error mounting app: ${error}</div>`;
  }
}

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
