import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import mysql from "mysql2/promise";
import { componentTagger } from "lovable-tagger";

// Load .env variables
const mode = process.env.NODE_ENV || "development";
const env = loadEnv(mode, process.cwd(), "");
Object.keys(env).forEach((key) => {
  if (typeof process.env[key] === "undefined") process.env[key] = env[key];
});

// Database API Plugin - handles /api.php requests
function databaseApiPlugin() {
  return {
    name: "database-api",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next();
        const url = req.url || "";
        if (url !== "/api.php") return next();

        try {
          // Parse request body
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const raw = Buffer.concat(chunks).toString() || "{}";
          const input = JSON.parse(raw);

          const action = (input.action || "").toLowerCase();

          // Response helper
          const respond = (status: string, message: string, data: any = null, code = 200) => {
            res.statusCode = code;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ status, message, data }));
          };

          // Get database config from environment
          const dbConfig = {
            host: process.env.DB_HOST || "127.0.0.1",
            user: process.env.DB_USER || "root",
            password: process.env.DB_PASS || "",
            database: process.env.DB_NAME || "trainer_db",
            port: parseInt(process.env.DB_PORT || "3306"),
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
          };

          // Handle migrate action
          if (action === "migrate") {
            let connection: any = null;
            try {
              connection = await mysql.createConnection(dbConfig);

              const createUsersTable = `
                CREATE TABLE IF NOT EXISTS \`users\` (
                  \`id\` VARCHAR(36) PRIMARY KEY,
                  \`email\` VARCHAR(255) NOT NULL UNIQUE,
                  \`phone\` VARCHAR(20),
                  \`password_hash\` VARCHAR(255) NOT NULL,
                  \`first_name\` VARCHAR(100),
                  \`last_name\` VARCHAR(100),
                  \`date_of_birth\` DATE,
                  \`status\` VARCHAR(50) DEFAULT 'active',
                  \`balance\` DECIMAL(15, 2) DEFAULT 0,
                  \`bonus_balance\` DECIMAL(15, 2) DEFAULT 0,
                  \`currency\` VARCHAR(3) DEFAULT 'KES',
                  \`country\` VARCHAR(100),
                  \`email_verified\` BOOLEAN DEFAULT FALSE,
                  \`phone_verified\` BOOLEAN DEFAULT FALSE,
                  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  \`last_login\` TIMESTAMP NULL,
                  \`kyc_status\` VARCHAR(50) DEFAULT 'pending',
                  INDEX idx_email (email),
                  INDEX idx_status (status),
                  INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
              `;

              await connection.execute(createUsersTable);

              const createProfilesTable = `
                CREATE TABLE IF NOT EXISTS \`user_profiles\` (
                  \`id\` VARCHAR(36) PRIMARY KEY,
                  \`user_id\` VARCHAR(36) NOT NULL UNIQUE,
                  \`user_type\` VARCHAR(50) NOT NULL DEFAULT 'client',
                  \`full_name\` VARCHAR(255),
                  \`phone_number\` VARCHAR(20),
                  \`bio\` TEXT,
                  \`profile_image\` VARCHAR(255),
                  \`disciplines\` JSON,
                  \`certifications\` JSON,
                  \`hourly_rate\` DECIMAL(10, 2),
                  \`service_radius\` INT,
                  \`availability\` JSON,
                  \`rating\` DECIMAL(3, 2),
                  \`total_reviews\` INT DEFAULT 0,
                  \`is_approved\` BOOLEAN DEFAULT FALSE,
                  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                  INDEX idx_user_id (user_id),
                  INDEX idx_user_type (user_type),
                  INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
              `;

              await connection.execute(createProfilesTable);

              respond("success", "Migration successful: users and user_profiles tables created or already exist.");
            } catch (err: any) {
              respond("error", `Migration failed: ${err.message}`, null, 500);
            } finally {
              if (connection) await connection.end();
            }
            return;
          }

          // Handle seed_all_users action
          if (action === "seed_all_users") {
            let connection: any = null;
            try {
              connection = await mysql.createConnection(dbConfig);

              const testUsers = [
                {
                  email: "admin@skatryk.co.ke",
                  password: "Pass1234",
                  first_name: "Admin",
                  last_name: "User",
                  user_type: "admin",
                  phone: "+254712345601",
                },
                {
                  email: "trainer@skatryk.co.ke",
                  password: "Pass1234",
                  first_name: "Trainer",
                  last_name: "User",
                  user_type: "trainer",
                  phone: "+254712345602",
                },
                {
                  email: "client@skatryk.co.ke",
                  password: "Pass1234",
                  first_name: "Client",
                  last_name: "User",
                  user_type: "client",
                  phone: "+254712345603",
                },
              ];

              let seeded = 0;
              let skipped = 0;
              const errors: string[] = [];

              for (const user of testUsers) {
                try {
                  // Check if user exists
                  const [rows]: any = await connection.execute(
                    "SELECT id FROM users WHERE email = ?",
                    [user.email]
                  );

                  if (rows.length > 0) {
                    skipped++;
                    continue;
                  }

                  // Generate IDs
                  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                  const profileId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                  // Hash password (using a simple approach - in production use bcrypt)
                  // For development, we'll just store a hash placeholder
                  const crypto = require("crypto");
                  const passwordHash = crypto
                    .createHash("sha256")
                    .update(user.password)
                    .digest("hex");

                  // Insert user
                  await connection.execute(
                    `INSERT INTO users (id, email, phone, password_hash, first_name, last_name, status, email_verified, phone_verified, currency, kyc_status, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, 'active', 1, 0, 'KES', 'pending', NOW())`,
                    [userId, user.email, user.phone, passwordHash, user.first_name, user.last_name]
                  );

                  // Insert profile
                  const fullName = `${user.first_name} ${user.last_name}`;
                  await connection.execute(
                    `INSERT INTO user_profiles (id, user_id, user_type, full_name, phone_number, created_at)
                     VALUES (?, ?, ?, ?, ?, NOW())`,
                    [profileId, userId, user.user_type, fullName, user.phone]
                  );

                  seeded++;
                } catch (err: any) {
                  errors.push(`${user.email}: ${err.message}`);
                }
              }

              const message = `Seeding complete: ${seeded} created, ${skipped} already exist.`;
              if (errors.length > 0) {
                respond("success", `${message} (with ${errors.length} warning(s))`, {
                  seeded,
                  skipped,
                  errors,
                });
              } else {
                respond("success", message, { seeded, skipped });
              }
            } catch (err: any) {
              respond("error", `Seeding failed: ${err.message}`, null, 500);
            } finally {
              if (connection) await connection.end();
            }
            return;
          }

          // Handle login action
          if (action === "login") {
            let connection: any = null;
            try {
              connection = await mysql.createConnection(dbConfig);
              const email = input.email || "";
              const password = input.password || "";

              if (!email || !password) {
                respond("error", "Email and password are required.", null, 400);
                return;
              }

              // Query user by email
              const [userRows]: any = await connection.execute(
                "SELECT u.id, u.email, u.password_hash, up.user_type FROM users u LEFT JOIN user_profiles up ON u.id = up.user_id WHERE u.email = ? LIMIT 1",
                [email]
              );

              if (userRows.length === 0) {
                respond("error", "Invalid email or password.", null, 401);
                return;
              }

              const user = userRows[0];
              const crypto = require("crypto");
              const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

              // Verify password
              if (user.password_hash !== passwordHash) {
                respond("error", "Invalid email or password.", null, 401);
                return;
              }

              // Generate session token (simple approach for development)
              const sessionToken = crypto.randomBytes(32).toString("hex");

              const responseData = {
                user: {
                  id: user.id,
                  email: user.email,
                },
                session: {
                  user: { id: user.id },
                  access_token: sessionToken,
                },
                profile: {
                  user_type: user.user_type || "client",
                },
              };

              respond("success", "Login successful.", responseData);
            } catch (err: any) {
              respond("error", `Login failed: ${err.message}`, null, 500);
            } finally {
              if (connection) await connection.end();
            }
            return;
          }

          // Handle signup action
          if (action === "signup") {
            let connection: any = null;
            try {
              connection = await mysql.createConnection(dbConfig);
              const email = input.email || "";
              const password = input.password || "";
              const userType = input.user_type || "client";

              if (!email || !password) {
                respond("error", "Email and password are required.", null, 400);
                return;
              }

              // Check if user already exists
              const [existingRows]: any = await connection.execute(
                "SELECT id FROM users WHERE email = ?",
                [email]
              );

              if (existingRows.length > 0) {
                respond("error", "User with this email already exists.", null, 400);
                return;
              }

              const crypto = require("crypto");
              const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const profileId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

              // Insert user
              await connection.execute(
                `INSERT INTO users (id, email, password_hash, status, email_verified, phone_verified, currency, kyc_status, created_at)
                 VALUES (?, ?, ?, 'active', 0, 0, 'KES', 'pending', NOW())`,
                [userId, email, passwordHash]
              );

              // Insert profile
              await connection.execute(
                `INSERT INTO user_profiles (id, user_id, user_type, created_at)
                 VALUES (?, ?, ?, NOW())`,
                [profileId, userId, userType]
              );

              // Generate session token
              const sessionToken = crypto.randomBytes(32).toString("hex");

              const responseData = {
                user: {
                  id: userId,
                  email: email,
                },
                session: {
                  user: { id: userId },
                  access_token: sessionToken,
                },
                profile: {
                  user_type: userType,
                },
              };

              respond("success", "Signup successful.", responseData);
            } catch (err: any) {
              respond("error", `Signup failed: ${err.message}`, null, 500);
            } finally {
              if (connection) await connection.end();
            }
            return;
          }

          // Unknown action
          respond("error", `Invalid action '${action}'.`, null, 400);
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ status: "error", message: err.message }));
        }
      });
    },
  };
}

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
    mode === 'development' && componentTagger(),
    databaseApiPlugin(),
    adminApiPlugin(),
    paymentsApiPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force all React imports to resolve to the same instance
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    esbuildOptions: {
      // Ensure React is treated as a single instance during build
      plugins: [],
    },
  },
}));
