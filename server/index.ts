import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import { setupAuth } from "./auth";
import {
  seedAdminTable,
  migrateBookingId,
  migrateInvoiceUrl,
  migrateInvoicePdf,
  migrateExtraServices,
  migrateGalleryItems,
  migrateGalleryLikes,
  migratePushSubscriptions,
  migratePageViews,
  migrateAndSeedServices,
  migrateAndSeedAdditionalEquipment,
  seedOperationalSchedule,
} from "./seed";

const app = express();

app.set("trust proxy", 1);

const HARDCODED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://joel-music.vercel.app",
];

const envOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((s) => s.trim())
  : [];

const allowedOrigins = Array.from(new Set([...HARDCODED_ORIGINS, ...envOrigins]));

console.log("[cors] Allowed origins:", allowedOrigins);

const isDev = process.env.NODE_ENV !== "production";

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server / same-origin requests (no Origin header)
    if (!origin) return callback(null, true);
    // In development, allow Replit preview domains
    if (isDev && origin.endsWith(".replit.dev")) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`[cors] Blocked origin: ${origin}`);
    // Return false (no header) — don't throw, which would cause a 500
    callback(null, false);
  },
  credentials: true,
}));

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(
  express.urlencoded({
    limit: "10mb",
    extended: true,
  }),
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

app.use((req, _res, next) => {
  if (
    req.url.startsWith("/api/admin/bookings") ||
    req.url.startsWith("/api/admin/costs") ||
    req.url.startsWith("/api/bookings") ||
    req.url.startsWith("/api/upload")
  ) {
    req.url = req.url.replace(/^\/api/, "");
  }
  next();
});

(async () => {
  setupAuth(app);
  await registerRoutes(httpServer, app);

  await migrateBookingId().catch((err) => console.error("Migration error:", err));
  await migrateInvoiceUrl().catch((err) => console.error("Migration invoice_url error:", err));
  await migrateInvoicePdf().catch((err) => console.error("Migration invoice_pdf error:", err));
  await migrateExtraServices().catch((err) => console.error("Migration extra_services error:", err));
  await migrateGalleryItems().catch((err) => console.error("Migration gallery_items error:", err));
  await migrateGalleryLikes().catch((err) => console.error("Migration gallery_likes error:", err));
  await migratePushSubscriptions().catch((err) => console.error("Migration push_subscriptions error:", err));
  if (typeof migratePageViews === "function") {
    await migratePageViews().catch((err) => console.error("Migration page_views error:", err));
  } else {
    console.warn("migratePageViews is not defined");
  }
  await seedAdminTable().catch((err) => console.error("Admin seed error:", err));
  await migrateAndSeedServices().catch((err) => console.error("Services seed error:", err));
  await migrateAndSeedAdditionalEquipment().catch((err) => console.error("Additional equipment seed error:", err));
  await seedOperationalSchedule().catch((err) => console.error("Operational schedule seed error:", err));

  if (process.env.SEED === "true") {
    const { seedDatabase } = await import("./seed");
    await seedDatabase().catch((err) => console.error("Seed error:", err));
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  const { storage } = await import("./storage");
  const runCleanup = async () => {
    try {
      const deleted = await storage.cleanupOldInvoicePdfs();
      if (deleted > 0) log(`Cleanup: ${deleted} invoice PDF(s) dihapus dari DB (>7 hari)`);
    } catch (err) {
      console.error("Cleanup invoice PDF error:", err);
    }
  };
  await runCleanup();
  setInterval(runCleanup, 24 * 60 * 60 * 1000);

  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);

  httpServer.listen(port, () => {
    log(`serving on http://localhost:${port}`);
  });
})();
