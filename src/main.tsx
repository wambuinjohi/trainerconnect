import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global error handlers
window.addEventListener('error', (event) => {
  // Global error handler
});

window.addEventListener('unhandledrejection', (event) => {
  // Unhandled promise rejection handler
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  document.body.innerHTML = "<div style='padding: 20px; color: red;'>Error: Root element not found in DOM</div>";
} else {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    document.body.innerHTML = `<div style='padding: 20px; color: red; font-family: monospace;'>Error mounting app: ${error}</div>`;
  }
}

// Prevent native install prompt on desktop
// The app is designed for mobile, so we suppress the desktop install UI
window.addEventListener("beforeinstallprompt", (e) => {
  // Check if device is mobile
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // Only allow the install prompt on mobile devices
  if (!isMobileDevice) {
    e.preventDefault();
  }
});

// Register a service worker for PWA/offline support (web only)
// Only register on web with HTTPS or localhost
// Skip registration on native platforms (Capacitor Android/iOS)
// where file:// protocol doesn't support service workers
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const shouldRegisterSW =
      (window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
      !window.location.protocol.startsWith("file");

    if (shouldRegisterSW) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Service worker registered
        })
        .catch((err) => {
          // Service worker registration failed
        });
    }
  });
}
