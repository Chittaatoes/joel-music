import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import type { Express, RequestHandler } from "express";
import { db } from "./db";
import { adminUsers } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    adminId: string;
    adminUsername: string;
  }
}

export function setupAuth(app: Express) {
  app.set("trust proxy", 1);

  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const isProduction = process.env.NODE_ENV === "production";

  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: sessionTtl,
      },
    })
  );
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username dan password wajib diisi" });
      }

      const [admin] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.username, username));

      if (!admin) {
        return res.status(401).json({ message: "Username atau password salah" });
      }

      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Username atau password salah" });
      }

      req.session.adminId = admin.id;
      req.session.adminUsername = admin.username;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Gagal menyimpan sesi" });
        }
        res.json({ id: admin.id, username: admin.username });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Gagal login" });
    }
  });

  app.get("/api/admin/me", (req, res) => {
    if (req.session.adminId) {
      return res.json({ id: req.session.adminId, username: req.session.adminUsername });
    }
    return res.status(401).json({ message: "Unauthorized" });
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Gagal logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Berhasil logout" });
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.session.adminId) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

export async function runMigrations() {
  try {
    await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'transfer'`);
    await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bukti_transfer text`);
  } catch (e) {
  }
}

export async function seedAdminUser() {
  const [existing] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.username, "joelmusic"));

  if (!existing) {
    const hash = await bcrypt.hash("kontolodon", 10);
    await db.insert(adminUsers).values({
      id: "ac0e46fd-97b8-42db-907b-3e540f063301",
      username: "joelmusic",
      passwordHash: hash,
    });
    console.log("Admin user seeded: joelmusic");
  }
}
