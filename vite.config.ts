import { defineConfig, loadEnv } from "vite";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Load .env variables
const mode = process.env.NODE_ENV || "development";
const env = loadEnv(mode, process.cwd(), "");
Object.keys(env).forEach((key) => {
  if (typeof process.env[key] === "undefined") process.env[key] = env[key];
});


function adminApiPlugin() {
  return {
    name: "admin-api",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next();
        const url = req.url || "";
        if (!url.startsWith("/__admin/")) return next();

        try {
          const adminTokenHeader = req.headers["x-admin-token"] as string | undefined;
          const expectedToken = process.env.ADMIN_TOKEN;
          const isListReq = url.startsWith("/__admin/list-users");

          if (!(isListReq && process.env.NODE_ENV !== "production")) {
            if (!expectedToken || adminTokenHeader !== expectedToken) {
              res.statusCode = 401;
              res.end("Unauthorized");
              return;
            }
          }

          // Example local DB connection or any custom backend API call
          // Replace with your own DB handler logic
          const db = {
            query: async (q: string, params?: any[]) => {
              console.log("Mock DB query:", q, params);
              return [];
            },
          };

          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const raw = Buffer.concat(chunks).toString() || "{}";
          const body = JSON.parse(raw);

          // Example: handle M-Pesa credential storage (replace with your local DB)
          if (url.startsWith("/__admin/set-mpesa-credentials")) {
            try {
              const creds = body.credentials || null;
              if (!creds) throw new Error("Missing credentials in body");
              await db.query("UPSERT INTO platform_secrets (key, value) VALUES (?, ?)", [
                "mpesa",
                JSON.stringify(creds),
              ]);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: e.message }));
            }
            return;
          }

          if (url.startsWith("/__admin/get-mpesa-credentials")) {
            try {
              const rows = await db.query("SELECT value FROM platform_secrets WHERE key = ?", ["mpesa"]);
              const value = rows.length ? JSON.parse((rows as any)[0].value) : null;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, credentials: value }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: e.message }));
            }
            return;
          }

          // Add other admin routes here as needed (no Supabase dependency)

          res.statusCode = 404;
          res.end(JSON.stringify({ ok: false, error: "Unknown endpoint" }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
    },
  };
}

// Example simplified payments plugin (M-Pesa only, no Supabase)
function paymentsApiPlugin() {
  return {
    name: "payments-api",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next();
        const url = req.url || "";
        if (!url.startsWith("/payments/mpesa/")) return next();

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const raw = Buffer.concat(chunks).toString() || "{}";
          const body = JSON.parse(raw);

          const creds = {
            consumer_key: process.env.MPESA_CONSUMER_KEY,
            consumer_secret: process.env.MPESA_CONSUMER_SECRET,
            shortcode: process.env.MPESA_SHORTCODE,
            passkey: process.env.MPESA_PASSKEY,
            environment: process.env.MPESA_ENVIRONMENT || "sandbox",
            result_url: process.env.MPESA_RESULT_URL,
          };

          const envMode = creds.environment;
          const tokenUrl =
            envMode === "production"
              ? "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
              : "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

          const basic = Buffer.from(
            `${creds.consumer_key}:${creds.consumer_secret}`
          ).toString("base64");

          const tokenRes = await fetch(tokenUrl, {
            headers: { Authorization: `Basic ${basic}` },
          });
          const tokenJson = await tokenRes.json() as any;
          const accessToken = tokenJson?.access_token;
          if (!accessToken) throw new Error("Failed to obtain access token");

          if (url.startsWith("/payments/mpesa/stk-initiate")) {
            const phone = String(body.phone || "").trim();
            const amount = Math.round(Number(body.amount || 0));
            const shortcode = creds.shortcode!;
            const passkey = creds.passkey!;
            const callback = creds.result_url || "https://example.com/mpesa/callback";
            const timestamp = new Date()
              .toISOString()
              .replace(/[-:.TZ]/g, "")
              .slice(0, 14);
            const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

            const stkUrl =
              envMode === "production"
                ? "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
                : "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

            const payload = {
              BusinessShortCode: shortcode,
              Password: password,
              Timestamp: timestamp,
              TransactionType: "CustomerPayBillOnline",
              Amount: amount,
              PartyA: phone,
              PartyB: shortcode,
              PhoneNumber: phone,
              CallBackURL: callback,
              AccountReference: "OrderRef",
              TransactionDesc: "Payment",
            };

            const stkRes = await fetch(stkUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            });

            const stkJson = await stkRes.json();
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, result: stkJson }));
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ ok: false, error: "Unknown payments route" }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
    },
  };
}

// Export final Vite config
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && adminApiPlugin(),
    mode === 'development' && paymentsApiPlugin(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    exclude: [],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Keep React and React-DOM in main bundle
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return undefined; // Keep in main bundle
          }
          // Group Radix UI components
          if (id.includes('@radix-ui')) {
            return 'radix-ui';
          }
          // Group tanstack/react-query
          if (id.includes('tanstack')) {
            return 'tanstack';
          }
          // Group other vendors
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
}));
