import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Verify React is available
if (!window.React) {
  console.warn("[main.tsx] React object not on window - this is expected with modern JSX");
}

// Global error handlers
window.addEventListener('error', (event) => {
  console.error('[Global Error Handler]', event.error);
  if (event.error?.message?.includes('useRef')) {
    console.error('[React Hook Error] Likely cause: Module resolution issue or duplicate React versions');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("Root element not found!");
  document.body.innerHTML = "<div style='padding: 20px; color: red; font-family: monospace;'>Error: Root element not found in DOM</div>";
} else {
  try {
    console.log("[main.tsx] Starting React app mount...");
    const root = createRoot(rootElement);

    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    console.log("[main.tsx] React app mounted successfully");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';

    console.error("[main.tsx] Failed to mount React app:", error);
    console.error("[main.tsx] Error details:", { errorMsg, errorStack });

    const isHookError = errorMsg.includes('useRef') || errorMsg.includes('Hook');
    const suggestion = isHookError
      ? '<br><br><strong>Suggestion:</strong> This appears to be a React hooks error. Try:<br>1. Clear browser cache<br>2. Check that all providers are properly nested<br>3. Ensure React modules are not duplicated'
      : '';

    document.body.innerHTML = `
      <div style='padding: 20px; color: red; font-family: monospace; white-space: pre-wrap; max-width: 800px;'>
        <h2>Error Mounting Application</h2>
        <p>${errorMsg}</p>
        ${suggestion}
        <hr style='margin: 20px 0;'>
        <details style='cursor: pointer;'>
          <summary>Stack trace (click to expand)</summary>
          <pre style='font-size: 11px; overflow-x: auto;'>${errorStack}</pre>
        </details>
      </div>
    `;
  }
}

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
          console.log("[SW] Service worker registered successfully", registration);
        })
        .catch((err) => {
          console.error("[SW] ServiceWorker registration failed: ", err);
          // Don't fail the app if SW fails to register
        });
    } else {
      console.log("[SW] Skipping service worker registration (protocol or hostname not supported)");
    }
  });
}
