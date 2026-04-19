import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage";
import { insertBookingSchema, insertDailyCostSchema, admins, bookings, pushSubscriptions, updateServiceSchema, insertServiceSchema, insertAdditionalEquipmentSchema, updateAdditionalEquipmentSchema } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import multer from "multer";
import sharp from "sharp";
import webpush from "web-push";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@joelmusic.studio",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function sendPushToAllAdmins(payload: object) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  try {
    const subs = await storage.getAllPushSubscriptions();
    if (!subs || subs.length === 0) return;
    const payloadStr = JSON.stringify(payload);
    for (const row of subs) {
      try {
        const sub = row.subscription;
        if (!sub || typeof (sub as any).endpoint !== "string") continue;
        await webpush.sendNotification(sub as any, payloadStr);
      } catch (err: any) {
        const code = err?.statusCode ?? err?.status;
        if (code === 410 || code === 404) {
          try {
            await storage.deletePushSubscription((row.subscription as any).endpoint);
          } catch {}
        } else {
          console.error("[push] sendNotification error:", err?.message ?? err);
        }
      }
    }
  } catch (err) {
    console.error("[push] sendPushToAllAdmins error:", err);
  }
}

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "gallery");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const galleryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Hanya file gambar yang diperbolehkan"));
  },
});

async function compressAndSaveImage(buffer: Buffer): Promise<string> {
  const filename = `gallery_${Date.now()}.jpg`;
  const outPath = path.join(UPLOADS_DIR, filename);
  await sharp(buffer)
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78, progressive: true, mozjpeg: true })
    .toFile(outPath);
  return filename;
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.session.adminId) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }
  return true;
}

const LAYANAN_MAP: Record<string, string> = {
  rehearsal: "Rehearsal",
  karaoke: "Karaoke",
  live_recording: "Live Record",
  cover_lagu: "Cover Lagu",
};

const PAYMENT_MAP: Record<string, string> = {
  transfer: "Transfer Bank",
  cash: "Cash",
};

function formatWaNumber(noWa: string): string {
  let num = noWa.replace(/[^0-9]/g, "");
  if (num.startsWith("0")) num = "62" + num.slice(1);
  if (!num.startsWith("62")) num = "62" + num;
  return num;
}

function formatTanggal(tanggal: string): string {
  const d = new Date(tanggal + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

function formatJam(jamMulai: number, durasi: number): string {
  const start = jamMulai.toString().padStart(2, "0") + ":00";
  const end = (jamMulai + durasi).toString().padStart(2, "0") + ":00";
  return `${start} - ${end} (${durasi} jam)`;
}

async function generateInvoicePDF(booking: any): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const invoiceId = `INV-${booking.bookingId || booking.id}`;
      const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));

      // ── LAYOUT CONSTANTS (landscape A4: 842×595) ─────────
      const PAGE_W = 842;
      const PAGE_H = 595;
      const M = 50;
      const CW = PAGE_W - M * 2;
      const LEFT_X = M;
      const LEFT_W = 460;
      const GAP = 22;
      const RIGHT_X = M + LEFT_W + GAP;
      const RIGHT_W = CW - LEFT_W - GAP;

      const C_DARK = "#111111";
      const C_MID  = "#444444";
      const C_GRAY = "#777777";
      const C_DIV  = "#E0E0E0";

      // ── PREPARE DATA ─────────────────────────────────────
      const allEquipment = await storage.getAdditionalEquipment();
      const extraServices = (booking.extraServices as any[] | null) || [];
      const isMultiService = extraServices.length > 1;

      // For each service, build line items
      type ServiceLineItem = {
        label: string;
        jamStr: string;
        durasi: number;
        subtotal: number;
        equipment: { name: string; price: number }[];
      };

      let serviceLineItems: ServiceLineItem[] = [];

      if (isMultiService) {
        for (const svc of extraServices) {
          const eqDetails: { name: string; price: number }[] = [];
          if (svc.withKeyboard) eqDetails.push({ name: "Keyboard", price: svc.durasi * 10000 });
          for (const eqId of (svc.selectedEquipmentIds || [])) {
            const eq = allEquipment.find((e) => e.id === eqId);
            if (eq) eqDetails.push({ name: eq.name, price: eq.pricePerHour * svc.durasi });
          }
          serviceLineItems.push({
            label: svc.name || LAYANAN_MAP[svc.key] || svc.key,
            jamStr: formatJam(svc.jamMulai, svc.durasi),
            durasi: svc.durasi,
            subtotal: svc.subtotal,
            equipment: eqDetails,
          });
        }
      } else {
        const selectedEquipmentIds = (booking.selectedEquipmentIds as string[] | null) || [];
        const equipmentDetails: { name: string; price: number }[] = [];
        if (booking.withKeyboard) equipmentDetails.push({ name: "Keyboard", price: booking.durasi * 10000 });
        for (const eqId of selectedEquipmentIds) {
          const eq = allEquipment.find((e) => e.id === eqId);
          if (eq) equipmentDetails.push({ name: eq.name, price: eq.pricePerHour * booking.durasi });
        }
        let servicePrice = booking.total;
        if (equipmentDetails.length > 0) {
          servicePrice = booking.total - equipmentDetails.reduce((s, e) => s + e.price, 0);
        }
        serviceLineItems.push({
          label: LAYANAN_MAP[booking.jenisLayanan] || booking.jenisLayanan,
          jamStr: formatJam(booking.jamMulai, booking.durasi),
          durasi: booking.durasi,
          subtotal: servicePrice,
          equipment: equipmentDetails,
        });
      }

      const invoiceDate = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
      const tanggalStr = formatTanggal(booking.tanggal);
      const paymentLabel = PAYMENT_MAP[booking.paymentMethod] || booking.paymentMethod;

      // ── HELPERS ──────────────────────────────────────────
      const hline = (y: number, x = M, w = CW, color = C_DIV) =>
        doc.save().strokeColor(color).lineWidth(0.5)
          .moveTo(x, y).lineTo(x + w, y).stroke().restore();

      const sectionLabel = (text: string, x: number, y: number, width = LEFT_W) =>
        doc.save().fontSize(8).font("Helvetica-Bold").fillColor(C_GRAY)
          .text(text.toUpperCase(), x, y, { width, characterSpacing: 1.1 }).restore();

      // ── WATERMARK ─────────────────────────────────────────
      try {
        const logoPath = path.join(process.cwd(), "client/public/images/logo.png");
        const logoW = 270;
        const logoX = (PAGE_W - logoW) / 2;
        const logoY = (PAGE_H - logoW) / 2;
        doc.save();
        doc.fillOpacity(0.05).strokeOpacity(0.05);
        doc.image(logoPath, logoX, logoY, { width: logoW });
        doc.restore();
        doc.fillOpacity(1).strokeOpacity(1);
      } catch (_) {
        doc.fillOpacity(1).strokeOpacity(1);
      }

      // ── HEADER ───────────────────────────────────────────
      let y = 42;

      doc.save().fontSize(22).font("Helvetica-Bold").fillColor(C_DARK)
        .text("JOEL MUSIC STUDIO", M, y, { width: CW, align: "center" }).restore();
      y += 28;

      doc.save().fontSize(9).font("Helvetica").fillColor(C_GRAY)
        .text("Booking Invoice", M, y, { width: CW, align: "center" }).restore();
      y += 14;

      hline(y);
      y += 12;

      const IL = RIGHT_X;
      const IV = RIGHT_X + 95;
      const iRows = [
        ["Invoice ID", invoiceId],
        ["Booking ID", String(booking.bookingId || booking.id)],
        ["Tanggal Invoice", invoiceDate],
      ];
      for (const [k, v] of iRows) {
        doc.save().fontSize(8.5).font("Helvetica").fillColor(C_GRAY).text(k, IL, y).restore();
        doc.save().fontSize(9).font("Helvetica-Bold").fillColor(C_DARK).text(v, IV, y).restore();
        y += 13;
      }
      y += 8;

      hline(y);
      y += 16;

      // ── LEFT COLUMN ──────────────────────────────────────
      let leftY = y;

      sectionLabel("Customer", LEFT_X, leftY);
      leftY += 12;

      const infoRows: [string, string][] = [
        ["Nama Band", booking.namaBand],
        ["No. WhatsApp", booking.noWa],
      ];
      for (const [k, v] of infoRows) {
        doc.save().fontSize(9.5).font("Helvetica").fillColor(C_GRAY).text(k, LEFT_X, leftY, { width: 85 }).restore();
        doc.save().fontSize(9.5).font("Helvetica").fillColor(C_DARK).text(v, LEFT_X + 90, leftY, { width: LEFT_W - 90 }).restore();
        leftY += 14;
      }
      leftY += 8;

      hline(leftY, LEFT_X, LEFT_W);
      leftY += 10;

      sectionLabel("Booking Details", LEFT_X, leftY);
      leftY += 12;

      if (isMultiService) {
        // Multi-service: show each service as a row
        const COL = [LEFT_X, LEFT_X + 130, LEFT_X + 285, LEFT_X + 390];
        const HEADS = ["Layanan", "Jam", "Durasi", "Person"];
        const COLW = [125, 150, 100, 60];
        for (let i = 0; i < HEADS.length; i++) {
          doc.save().fontSize(8.5).font("Helvetica-Bold").fillColor(C_MID)
            .text(HEADS[i], COL[i], leftY, { width: COLW[i] }).restore();
        }
        leftY += 4;
        hline(leftY + 8, LEFT_X, LEFT_W, "#CCCCCC");
        leftY += 13;

        // Tanggal row
        doc.save().fontSize(9).font("Helvetica").fillColor(C_GRAY)
          .text(`Tanggal: ${tanggalStr}`, LEFT_X, leftY).restore();
        leftY += 14;

        for (const svcItem of serviceLineItems) {
          const DATA = [svcItem.label, svcItem.jamStr, `${svcItem.durasi} jam`, String(booking.jumlahPerson)];
          for (let i = 0; i < DATA.length; i++) {
            doc.save().fontSize(9.5).font("Helvetica").fillColor(C_DARK)
              .text(DATA[i], COL[i], leftY, { width: COLW[i] }).restore();
          }
          if (svcItem.equipment.length > 0) {
            leftY += 13;
            doc.save().fontSize(8.5).font("Helvetica").fillColor(C_GRAY)
              .text(`  Alat: ${svcItem.equipment.map(e => e.name).join(", ")}`, LEFT_X, leftY, { width: LEFT_W }).restore();
          }
          leftY += 14;
        }
      } else {
        // Single service: original layout
        const COL = [LEFT_X, LEFT_X + 100, LEFT_X + 220, LEFT_X + 330];
        const HEADS = ["Tanggal", "Jam", "Layanan", "Person"];
        const COLW = [96, 115, 105, 60];
        for (let i = 0; i < HEADS.length; i++) {
          doc.save().fontSize(8.5).font("Helvetica-Bold").fillColor(C_MID)
            .text(HEADS[i], COL[i], leftY, { width: COLW[i] }).restore();
        }
        leftY += 4;
        hline(leftY + 8, LEFT_X, LEFT_W, "#CCCCCC");
        leftY += 13;

        const svcItem = serviceLineItems[0];
        const DATA = [tanggalStr, svcItem.jamStr, svcItem.label, String(booking.jumlahPerson)];
        for (let i = 0; i < DATA.length; i++) {
          doc.save().fontSize(10).font("Helvetica").fillColor(C_DARK)
            .text(DATA[i], COL[i], leftY, { width: COLW[i] }).restore();
        }
        leftY += 16;

        doc.save().fontSize(9).font("Helvetica").fillColor(C_GRAY)
          .text(`Durasi: ${svcItem.durasi} jam`, LEFT_X, leftY).restore();
        leftY += 14;

        if (svcItem.equipment.length > 0) {
          doc.save().fontSize(9).font("Helvetica").fillColor(C_GRAY)
            .text("Alat Tambahan:", LEFT_X, leftY).restore();
          leftY += 13;
          for (const eq of svcItem.equipment) {
            doc.save().fontSize(9.5).font("Helvetica").fillColor(C_DARK)
              .text(`• ${eq.name}`, LEFT_X + 6, leftY).restore();
            leftY += 12;
          }
        }
      }

      // ── RIGHT COLUMN: PAYMENT SUMMARY ────────────────────
      let rightY = y;

      const cardPad = 14;
      const lineH = 16;
      const totalLineItems = serviceLineItems.reduce((sum, s) => sum + 1 + s.equipment.length, 0);
      const cardH = cardPad
        + 14
        + totalLineItems * lineH
        + 10
        + 32
        + 13
        + 16
        + 8
        + 26
        + cardPad;

      doc.save().roundedRect(RIGHT_X - 12, rightY - 8, RIGHT_W + 24, cardH, 6)
        .strokeColor(C_DIV).lineWidth(1).stroke().restore();

      sectionLabel("Payment Summary", RIGHT_X, rightY, RIGHT_W);
      rightY += 16;

      for (const svcItem of serviceLineItems) {
        doc.save().fontSize(9.5).font("Helvetica").fillColor(C_GRAY)
          .text(svcItem.label, RIGHT_X, rightY, { width: RIGHT_W - 80 }).restore();
        doc.save().fontSize(9.5).font("Helvetica").fillColor(C_DARK)
          .text(`Rp ${svcItem.subtotal.toLocaleString("id-ID")}`, RIGHT_X, rightY, { width: RIGHT_W, align: "right" }).restore();
        rightY += lineH;

        for (const eq of svcItem.equipment) {
          doc.save().fontSize(8.5).font("Helvetica").fillColor(C_GRAY)
            .text(`  + ${eq.name}`, RIGHT_X, rightY, { width: RIGHT_W - 80 }).restore();
          doc.save().fontSize(8.5).font("Helvetica").fillColor(C_DARK)
            .text(`Rp ${eq.price.toLocaleString("id-ID")}`, RIGHT_X, rightY, { width: RIGHT_W, align: "right" }).restore();
          rightY += lineH;
        }
      }

      hline(rightY + 5, RIGHT_X, RIGHT_W, "#CCCCCC");
      rightY += 16;

      doc.save().fontSize(11).font("Helvetica-Bold").fillColor(C_DARK)
        .text("Total", RIGHT_X, rightY + 2).restore();
      doc.save().fontSize(16).font("Helvetica-Bold").fillColor("#1E3A5F")
        .text(`Rp ${booking.total.toLocaleString("id-ID")}`, RIGHT_X, rightY - 2, { width: RIGHT_W, align: "right" }).restore();
      rightY += 32;

      doc.save().fontSize(8).font("Helvetica").fillColor(C_GRAY)
        .text("Metode Pembayaran", RIGHT_X, rightY).restore();
      rightY += 13;
      doc.save().fontSize(9.5).font("Helvetica-Bold").fillColor(C_DARK)
        .text(paymentLabel, RIGHT_X, rightY).restore();
      rightY += 16;

      const badgeW = RIGHT_W;
      const badgeH = 26;
      doc.save().roundedRect(RIGHT_X, rightY + 4, badgeW, badgeH, 4)
        .fillColor("#DCFCE7").fill().restore();
      doc.save().fontSize(10).font("Helvetica-Bold").fillColor("#166534")
        .text("LUNAS", RIGHT_X, rightY + 11, { width: badgeW, align: "center" }).restore();

      // ── FOOTER ───────────────────────────────────────────
      const footerY = Math.max(leftY, rightY + badgeH + 14) + 18;

      hline(footerY);

      doc.save().fontSize(9).font("Helvetica").fillColor(C_GRAY)
        .text("Terima kasih telah booking di Joel Music Studio!", M, footerY + 12, { width: CW, align: "center" }).restore();

      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function calculatePriceFallback(service: string, durasi: number, withKeyboard = false): number {
  switch (service) {
    case "rehearsal": {
      const base = durasi === 3 ? 190000 : durasi * 65000;
      return base + (withKeyboard ? durasi * 10000 : 0);
    }
    case "karaoke":
      return durasi === 2 ? 100000 : durasi * 55000;
    case "live_recording":
      return durasi * 100000;
    case "cover_lagu":
      return 500000;
    default:
      return durasi * 65000;
  }
}

async function calculatePrice(service: string, durasi: number, withKeyboard = false, selectedEquipmentIds: string[] = []): Promise<number> {
  try {
    const svc = await storage.getServiceByKey(service);
    if (!svc) return calculatePriceFallback(service, durasi, withKeyboard);

    if (svc.isFixedPrice && svc.fixedPrice != null) return svc.fixedPrice;

    const tiers = (svc.pricingTiers as { hours: number; price: number }[] | null) || [];
    const tier = tiers.find((t) => t.hours === durasi);
    let base = tier ? tier.price : (svc.pricePerHour || 0) * durasi;

    if (withKeyboard && service === "rehearsal") base += durasi * 10000;

    if (selectedEquipmentIds.length > 0) {
      const equipment = await storage.getAdditionalEquipment();
      for (const eqId of selectedEquipmentIds) {
        const eq = equipment.find((e) => e.id === eqId);
        if (eq) base += eq.pricePerHour * durasi;
      }
    }

    return base;
  } catch {
    return calculatePriceFallback(service, durasi, withKeyboard);
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  const loginHandler = async (req: any, res: any) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username dan password wajib diisi" });
      }
      const [admin] = await db.select().from(admins).where(eq(admins.username, username));
      if (!admin) return res.status(401).json({ message: "Username atau password salah" });

      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (!valid) return res.status(401).json({ message: "Username atau password salah" });

      req.session.adminId = admin.id;
      req.session.adminUsername = admin.username;
      req.session.save((err: any) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Gagal menyimpan sesi" });
        }
        return res.json({ message: "Login berhasil", adminId: admin.id });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login gagal" });
    }
  };

  app.post("/admin/login", loginHandler);
  app.post("/api/admin/login", loginHandler);

  const meHandler = (req: any, res: any) => {
    if (req.session && req.session.adminId) {
      return res.json({ id: req.session.adminId, username: req.session.adminUsername });
    }
    return res.status(401).json({ message: "Unauthorized" });
  };
  app.get("/admin/me", meHandler);
  app.get("/api/admin/me", meHandler);

  const logoutHandler = (req: any, res: any) => {
    req.session.destroy((err: any) => {
      if (err) return res.status(500).json({ message: "Gagal logout" });
      res.clearCookie("connect.sid", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      });
      res.json({ message: "Berhasil logout" });
    });
  };
  app.post("/admin/logout", logoutHandler);
  app.post("/api/admin/logout", logoutHandler);

  app.get("/health", async (_req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [services, bookings, equipment, schedule] = await Promise.all([
        storage.getActiveServices(),
        storage.getBookingsByDate(today),
        storage.getAdditionalEquipment(),
        storage.getOperationalSchedule(),
      ]);
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        services: services.length,
        bookingsToday: bookings.length,
        equipment: equipment.length,
        scheduleDays: schedule.length,
      });
    } catch (err) {
      res.status(500).json({ status: "error", message: String(err) });
    }
  });

  app.get("/api/invoices/:invoiceFile", async (req, res) => {
    try {
      const invoiceFile = req.params.invoiceFile;
      const invoiceId = invoiceFile.endsWith(".pdf") ? invoiceFile.slice(0, -4) : invoiceFile;
      const bookingIdPart = invoiceId.startsWith("INV-") ? invoiceId.slice(4) : invoiceId;
      const pdfBase64 = await storage.getInvoicePdfByBookingId(bookingIdPart);
      if (!pdfBase64) {
        return res.status(404).json({ message: "Invoice tidak ditemukan atau sudah dihapus (lebih dari 7 hari)" });
      }
      const pdfBuffer = Buffer.from(pdfBase64, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${invoiceId}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (err) {
      res.status(500).json({ message: "Gagal mengambil invoice" });
    }
  });

  app.get("/api/services", async (req, res) => {
    try {
      const activeServices = await storage.getActiveServices();
      res.json(activeServices);
    } catch {
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.get("/api/admin/services", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const allServices = await storage.getServices();
      res.json(allServices);
    } catch {
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.post("/api/admin/services", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const parsed = insertServiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Data tidak valid", errors: parsed.error.errors });
      }
      const svc = await storage.createService(parsed.data);
      res.status(201).json(svc);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.patch("/api/admin/services/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { id } = req.params;
      const parsed = updateServiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Data tidak valid", errors: parsed.error.errors });
      }
      const svc = await storage.updateService(id, parsed.data);
      if (!svc) return res.status(404).json({ message: "Layanan tidak ditemukan" });
      res.json(svc);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/admin/services/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { id } = req.params;
      const deleted = await storage.deleteService(id);
      if (!deleted) return res.status(404).json({ message: "Layanan tidak ditemukan" });
      res.json({ message: "Layanan berhasil dihapus" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  app.get("/api/admin/equipment", async (req, res) => {
    try {
      const equipment = await storage.getAdditionalEquipment();
      res.json(equipment);
    } catch {
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  app.post("/api/admin/equipment", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const parsed = insertAdditionalEquipmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Data tidak valid", errors: parsed.error.errors });
      }
      const equipment = await storage.createAdditionalEquipment(parsed.data);
      res.status(201).json(equipment);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to create equipment" });
    }
  });

  app.patch("/api/admin/equipment/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { id } = req.params;
      const parsed = updateAdditionalEquipmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Data tidak valid", errors: parsed.error.errors });
      }
      const equipment = await storage.updateAdditionalEquipment(id, parsed.data);
      if (!equipment) return res.status(404).json({ message: "Alat tidak ditemukan" });
      res.json(equipment);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to update equipment" });
    }
  });

  app.delete("/api/admin/equipment/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { id } = req.params;
      const deleted = await storage.deleteAdditionalEquipment(id);
      if (!deleted) return res.status(404).json({ message: "Alat tidak ditemukan" });
      res.json({ message: "Alat berhasil dihapus" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to delete equipment" });
    }
  });

  app.get("/api/operational-schedule", async (_req, res) => {
    try {
      const schedule = await storage.getOperationalSchedule();
      res.json(schedule);
    } catch {
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  app.patch("/api/admin/operational-schedule/:dayOfWeek", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const dayOfWeek = parseInt(req.params.dayOfWeek);
      if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return res.status(400).json({ message: "dayOfWeek harus 0-6" });
      }
      const { isOpen, openHour, closeHour } = req.body;
      const updated = await storage.updateOperationalScheduleDay(dayOfWeek, {
        ...(isOpen !== undefined && { isOpen }),
        ...(openHour !== undefined && { openHour: parseInt(openHour) }),
        ...(closeHour !== undefined && { closeHour: parseInt(closeHour) }),
      });
      if (!updated) return res.status(404).json({ message: "Hari tidak ditemukan" });
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to update schedule" });
    }
  });

  app.get("/bookings/schedule/:date", async (req, res) => {
    try {
      const { date } = req.params;
      const bookings = await storage.getBookingsByDate(date);
      res.json(bookings);
    } catch {
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  app.post("/bookings/status", async (req, res) => {
    try {
      const parsed = z.object({ bookingIds: z.array(z.string()).min(1).max(100) }).safeParse(req.body);
      if (!parsed.success) return res.json([]);
      const statuses = await storage.getBookingStatusesByBookingIds(parsed.data.bookingIds);
      res.json(statuses);
    } catch {
      res.status(500).json({ message: "Failed to fetch statuses" });
    }
  });

  app.post("/bookings", async (req, res) => {
    try {
      const parsed = insertBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error("[booking] Validation failed:", parsed.error.errors);
        return res.status(400).json({ message: "Data tidak valid", errors: parsed.error.errors });
      }

      const { tanggal, jamMulai, durasi, jenisLayanan, withKeyboard } = parsed.data;
      const selectedEquipmentIds = (req.body.selectedEquipmentIds as string[]) || [];
      const extraServices = (parsed.data.extraServices as any[] | null) || null;

      // Check availability for primary service slot
      let isAvailable: boolean;
      try {
        isAvailable = await storage.checkSlotAvailability(tanggal, jamMulai, durasi);
      } catch (err) {
        console.error("[booking] checkSlotAvailability error:", err);
        return res.status(500).json({ message: "Gagal mengecek ketersediaan slot" });
      }
      if (!isAvailable) {
        return res.status(409).json({ message: "Slot waktu yang dipilih sudah tidak tersedia" });
      }

      // For multi-service: check each extra service slot availability on its own tanggal
      if (extraServices && extraServices.length > 1) {
        for (const svc of extraServices) {
          const svcTanggal = svc.tanggal || tanggal;
          if (svcTanggal === tanggal && svc.jamMulai === jamMulai && svc.key === jenisLayanan) continue;
          let ok: boolean;
          try {
            ok = await storage.checkSlotAvailability(svcTanggal, svc.jamMulai, svc.durasi);
          } catch (err) {
            console.error("[booking] checkSlotAvailability extra error:", err);
            return res.status(500).json({ message: "Gagal mengecek ketersediaan slot" });
          }
          if (!ok) {
            return res.status(409).json({ message: `Slot waktu ${svc.name} sudah tidak tersedia` });
          }
        }
      }

      // Calculate total
      let total: number;
      try {
        if (extraServices && extraServices.length > 1) {
          total = extraServices.reduce((sum: number, s: any) => sum + (s.subtotal || 0), 0);
        } else {
          total = await calculatePrice(jenisLayanan, durasi, withKeyboard, selectedEquipmentIds);
        }
      } catch (err) {
        console.error("[booking] calculatePrice error:", err);
        return res.status(500).json({ message: "Gagal menghitung harga" });
      }

      const dateParts = tanggal.split("-");
      const yy = dateParts[0].slice(2);
      const mm = dateParts[1];
      const dd = dateParts[2];

      let count: number;
      try {
        count = await storage.countBookingsByDate(tanggal);
      } catch (err) {
        console.error("[booking] countBookingsByDate error:", err);
        return res.status(500).json({ message: "Gagal membuat booking ID" });
      }
      const seq = String(count + 1).padStart(2, "0");
      const bookingId = `${yy}${mm}${dd}-${seq}`;

      const paymentMethod = (req.body.paymentMethod as string) === "cash" ? "cash" : "transfer";

      let booking: any;
      try {
        booking = await storage.createBooking({
          ...parsed.data,
          total,
          bookingId,
          selectedEquipmentIds,
          paymentMethod,
          extraServices: extraServices && extraServices.length > 1 ? extraServices : null,
        });
      } catch (err) {
        console.error("[booking] createBooking DB error:", err);
        return res.status(500).json({ message: "Gagal menyimpan booking ke database" });
      }

      // Fire-and-forget push notification — MUST NOT block or throw to caller
      sendPushToAllAdmins({
        title: "Joel Music Studio",
        body: "Ada yang booking nihh, Cek Dashboard yuuk 😊",
        url: "/admin/dashboard",
        icon: "/images/logo.png",
      }).catch((err) => {
        console.error("[booking] push notification unexpected error:", err);
      });

      res.status(201).json(booking);
    } catch (err) {
      console.error("[booking] Unhandled error in POST /bookings:", err);
      res.status(500).json({ message: "Terjadi kesalahan server saat membuat booking" });
    }
  });

  app.get("/admin/bookings/all", async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      res.json(bookings);
    } catch {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get("/admin/bookings/range", async (req, res) => {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      if (!from || !to) return res.status(400).json({ message: "Parameter from dan to diperlukan" });
      const bookings = await storage.getBookingsByDateRange(from, to);
      res.json(bookings);
    } catch {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get("/admin/costs/range", async (req, res) => {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      if (!from || !to) return res.status(400).json({ message: "Parameter from dan to diperlukan" });
      const costs = await storage.getCostsByDateRange(from, to);
      res.json(costs);
    } catch {
      res.status(500).json({ message: "Failed to fetch costs" });
    }
  });

  app.get("/admin/bookings/:date", async (req, res) => {
    try {
      const { date } = req.params;
      const bookings = await storage.getBookingsByDate(date);
      res.json(bookings);
    } catch {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.patch("/admin/bookings/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!["confirmed", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Status tidak valid" });
      }
      const booking = await storage.updateBookingStatus(id, status);
      if (!booking) return res.status(404).json({ message: "Booking tidak ditemukan" });
      res.json(booking);
    } catch {
      res.status(500).json({ message: "Failed to update booking status" });
    }
  });

  app.post("/admin/bookings/:id/approve", async (req, res) => {
    try {
      const { id } = req.params;
      const booking = await storage.getBookingById(id);
      if (!booking) return res.status(404).json({ message: "Booking tidak ditemukan" });
      if (booking.status !== "pending") return res.status(400).json({ message: "Booking sudah diproses sebelumnya" });

      const extraServices = (booking.extraServices as any[] | null) || [];
      const isMultiService = extraServices.length > 1;

      // Recalculate correct total
      let correctTotal: number;
      if (isMultiService) {
        correctTotal = extraServices.reduce((sum: number, s: any) => sum + (s.subtotal || 0), 0);
      } else {
        const selectedEqIds = (booking.selectedEquipmentIds as string[] | null) || [];
        correctTotal = await calculatePrice(booking.jenisLayanan, booking.durasi, booking.withKeyboard, selectedEqIds);
      }

      if (correctTotal !== booking.total) {
        await db.update(bookings).set({ total: correctTotal }).where(eq(bookings.id, id));
      }

      await storage.updateBookingStatus(id, "confirmed");

      const bookingForInvoice = { ...booking, total: correctTotal };
      const pdfBuffer = await generateInvoicePDF(bookingForInvoice);
      const pdfBase64 = pdfBuffer.toString("base64");

      const proto = ((req.headers["x-forwarded-proto"] as string) || req.protocol || "https").split(",")[0].trim();
      const host = ((req.headers["x-forwarded-host"] as string) || req.headers.host || "").split(",")[0].trim();
      const invoiceId = `INV-${booking.bookingId || booking.id}`;
      const fullInvoiceUrl = `${proto}://${host}/api/invoices/${invoiceId}.pdf`;
      await storage.saveInvoicePdf(id, fullInvoiceUrl, pdfBase64);

      const waNumber = formatWaNumber(booking.noWa);
      const tanggalStr = formatTanggal(booking.tanggal);
      const metodeStr = PAYMENT_MAP[booking.paymentMethod] || booking.paymentMethod;

      let layananLines = "";
      if (isMultiService) {
        for (const svc of extraServices) {
          const jamStr = formatJam(svc.jamMulai, svc.durasi);
          const svcName = svc.name || LAYANAN_MAP[svc.key] || svc.key;
          const svcTanggal = svc.tanggal ? formatTanggal(svc.tanggal) : tanggalStr;
          const dateLabel = svc.tanggal && svc.tanggal !== booking.tanggal ? `${svcTanggal}, ` : "";
          layananLines += `\u{1F3B8} ${svcName}: ${dateLabel}${jamStr}\n`;
        }
      } else {
        const jamStr = formatJam(booking.jamMulai, booking.durasi);
        const layananStr = LAYANAN_MAP[booking.jenisLayanan] || booking.jenisLayanan;
        const selectedEqIds = (booking.selectedEquipmentIds as string[] | null) || [];
        const allEquipment = selectedEqIds.length > 0 ? await storage.getAdditionalEquipment() : [];
        const addonsDetails: string[] = [];
        if (booking.withKeyboard) addonsDetails.push("Keyboard");
        for (const eqId of selectedEqIds) {
          const eq = allEquipment.find((e) => e.id === eqId);
          if (eq) addonsDetails.push(eq.name);
        }
        const alatLine = addonsDetails.length > 0 ? `\n\u{1F3B9} Alat Tambahan: ${addonsDetails.join(", ")}` : "";
        layananLines = `\u23F0 Jam: ${jamStr}\n\u{1F3B8} Layanan: ${layananStr}${alatLine}\n`;
      }

      const message = `\u{1F3B5} JOEL MUSIC STUDIO\n\nHalo ${booking.namaBand} \u{1F44B}\n\nBooking kamu sudah dikonfirmasi \u2705\n\n\u{1F4CC} Booking ID: ${booking.bookingId || booking.id}\n\u{1F5D3}\uFE0F Tanggal: ${tanggalStr}\n${layananLines}\n\u{1F4B0} Total: Rp ${correctTotal.toLocaleString("id-ID")}\nMetode Pembayaran: ${metodeStr}\n\nSilakan datang 10 menit sebelum jadwal \u{1F64F}\nTerima kasih!`;
      const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
      res.json({ success: true, whatsappUrl });
    } catch (error) {
      console.error("Approve error:", error);
      res.status(500).json({ message: "Gagal approve booking" });
    }
  });

  app.post("/admin/bookings/:id/reject", async (req, res) => {
    try {
      const { id } = req.params;
      const booking = await storage.getBookingById(id);
      if (!booking) return res.status(404).json({ message: "Booking tidak ditemukan" });
      if (booking.status !== "pending") return res.status(400).json({ message: "Booking sudah diproses sebelumnya" });

      await storage.updateBookingStatus(id, "rejected");

      const waNumber = formatWaNumber(booking.noWa);
      const tanggalStr = formatTanggal(booking.tanggal);
      const jamStr = formatJam(booking.jamMulai, booking.durasi);

      const message = `\u{1F3B5} JOEL MUSIC STUDIO\n\nHalo ${booking.namaBand} \u{1F44B}\n\nMohon maaf \u{1F64F}\n\nBooking dengan ID ${booking.bookingId || booking.id}\nuntuk tanggal ${tanggalStr} jam ${jamStr}\nbelum dapat kami terima.\n\nSilakan pilih jadwal lain atau hubungi admin untuk info lebih lanjut.\n\nTerima kasih atas pengertiannya.`;
      const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
      res.json({ success: true, whatsappUrl });
    } catch (error) {
      console.error("Reject error:", error);
      res.status(500).json({ message: "Gagal reject booking" });
    }
  });

  app.delete("/admin/bookings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteBooking(id);
      if (!deleted) return res.status(404).json({ message: "Booking tidak ditemukan" });
      res.json({ message: "Booking berhasil dihapus" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Gagal menghapus booking" });
    }
  });

  app.get("/admin/costs/:date", async (req, res) => {
    try {
      const { date } = req.params;
      const costs = await storage.getCostsByDate(date);
      res.json(costs);
    } catch {
      res.status(500).json({ message: "Failed to fetch costs" });
    }
  });

  app.post("/admin/costs", async (req, res) => {
    try {
      const parsed = insertDailyCostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Data tidak valid", errors: parsed.error.errors });
      }
      const cost = await storage.createCost(parsed.data);
      res.status(201).json(cost);
    } catch {
      res.status(500).json({ message: "Failed to create cost" });
    }
  });

  app.patch("/admin/costs/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { id } = req.params;
      const { cost: costAmount, keterangan } = req.body;
      const updateData: any = {};
      if (costAmount !== undefined) updateData.cost = Number(costAmount);
      if (keterangan !== undefined) updateData.keterangan = String(keterangan);
      if (updateData.cost !== undefined && (isNaN(updateData.cost) || updateData.cost < 0)) {
        return res.status(400).json({ message: "Jumlah cost tidak valid" });
      }
      const updated = await storage.updateCost(id, updateData);
      if (!updated) return res.status(404).json({ message: "Cost tidak ditemukan" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update cost" });
    }
  });

  app.delete("/admin/costs/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCost(id);
      if (!deleted) return res.status(404).json({ message: "Cost tidak ditemukan" });
      res.json({ message: "Cost berhasil dihapus" });
    } catch {
      res.status(500).json({ message: "Failed to delete cost" });
    }
  });

  app.post("/upload/bukti", async (req, res) => {
    try {
      const { bookingId, buktiUrl } = req.body;
      if (!bookingId || !buktiUrl) {
        return res.status(400).json({ message: "Data tidak lengkap" });
      }
      const updated = await storage.updateBookingBuktiTransfer(bookingId, buktiUrl);
      if (!updated) return res.status(404).json({ message: "Booking tidak ditemukan" });
      res.json({ success: true, message: "Bukti berhasil disimpan", booking: updated });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to upload bukti" });
    }
  });

  app.post("/api/track-visit", async (req, res) => {
    try {
      const { page } = req.body;
      if (!page || typeof page !== "string") return res.status(400).json({ message: "page required" });
      await storage.trackPageView(page.slice(0, 100));
      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });

  app.get("/api/admin/stats/visits", async (req, res) => {
    if (!requireAdmin(req as any, res)) return;
    try {
      const stats = await storage.getPageViewStats();
      res.json(stats);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch visit stats" });
    }
  });

  app.get("/api/admin/stats/hourly", async (req, res) => {
    if (!requireAdmin(req as any, res)) return;
    try {
      const stats = await storage.getHourlyStats();
      res.json(stats);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch hourly stats" });
    }
  });

  app.get("/api/gallery", async (_req, res) => {
    try {
      const items = await storage.getGalleryItems();
      res.json(items.filter((i) => i.isActive));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch gallery" });
    }
  });

  app.get("/api/gallery/liked", async (req, res) => {
    try {
      const deviceId = req.query.deviceId as string;
      if (!deviceId) return res.json([]);
      const ids = await storage.getGalleryLikedIds(deviceId);
      res.json(ids);
    } catch {
      res.json([]);
    }
  });

  app.post("/api/gallery/:id/like", async (req, res) => {
    try {
      const { deviceId } = req.body;
      if (!deviceId) return res.status(400).json({ message: "deviceId wajib diisi" });
      const result = await storage.toggleGalleryLike(req.params.id, deviceId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Gagal memperbarui like" });
    }
  });

  app.get("/api/admin/gallery", async (req, res) => {
    if (!requireAdmin(req as any, res)) return;
    try {
      const items = await storage.getGalleryItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch gallery" });
    }
  });

  app.get("/api/admin/gallery/confirmed-bands", async (req, res) => {
    if (!requireAdmin(req as any, res)) return;
    try {
      const bands = await storage.getConfirmedBandSuggestions(2);
      res.json(bands);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch band suggestions" });
    }
  });

  app.post("/api/admin/gallery", async (req: any, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { imageUrl, bandName, serviceType, quote } = req.body;
      if (!imageUrl || !bandName || !serviceType) {
        return res.status(400).json({ message: "imageUrl, bandName, dan serviceType wajib diisi" });
      }
      const item = await storage.createGalleryItem({
        imageUrl: imageUrl.trim(),
        bandName: bandName.trim(),
        serviceType,
        quote: quote?.trim() || null,
        isActive: true,
        sortOrder: 0,
      });
      res.json(item);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Gagal menyimpan galeri" });
    }
  });

  app.delete("/api/admin/gallery/:id", async (req: any, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const ok = await storage.deleteGalleryItem(req.params.id);
      if (!ok) return res.status(404).json({ message: "Item tidak ditemukan" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Gagal menghapus item galeri" });
    }
  });

  app.get("/api/admin/push/vapid-key", (_req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
  });

  app.post("/api/admin/push/subscribe", async (req: any, res) => {
    if (!req.session?.adminId) return res.status(401).json({ message: "Unauthorized" });
    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ message: "Invalid subscription" });
    try {
      await storage.savePushSubscription(req.session.adminUsername || "admin", subscription.endpoint, subscription);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to save subscription" });
    }
  });

  app.post("/api/admin/push/unsubscribe", async (req: any, res) => {
    if (!req.session?.adminId) return res.status(401).json({ message: "Unauthorized" });
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ message: "Endpoint required" });
    try {
      await storage.deletePushSubscription(endpoint);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to remove subscription" });
    }
  });

  return httpServer;
}
