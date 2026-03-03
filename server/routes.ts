import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBookingSchema, insertDailyCostSchema, admins } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import express from "express";

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
  if (num.startsWith("0")) {
    num = "62" + num.slice(1);
  }
  if (!num.startsWith("62")) {
    num = "62" + num;
  }
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

function generateInvoicePDF(booking: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const invoicesDir = path.resolve(process.cwd(), "public", "invoices");
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const invoiceId = `INV-${booking.bookingId || booking.id}`;
    const fileName = `${invoiceId}.pdf`;
    const filePath = path.join(invoicesDir, fileName);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc.fontSize(22).font("Helvetica-Bold").text("JOEL MUSIC STUDIO", { align: "center" });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    doc.fontSize(11).font("Helvetica");
    doc.text(`Invoice ID: ${invoiceId}`);
    doc.text(`Booking ID: ${booking.bookingId || booking.id}`);
    doc.text(`Tanggal Invoice: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`);
    doc.moveDown(1);

    doc.fontSize(13).font("Helvetica-Bold").text("Customer");
    doc.fontSize(11).font("Helvetica");
    doc.text(`Nama Band: ${booking.namaBand}`);
    doc.text(`No WA: ${booking.noWa}`);
    doc.moveDown(1);

    doc.fontSize(13).font("Helvetica-Bold").text("Detail Booking");
    doc.fontSize(11).font("Helvetica");
    doc.text(`Tanggal: ${formatTanggal(booking.tanggal)}`);
    doc.text(`Jam: ${formatJam(booking.jamMulai, booking.durasi)}`);
    doc.text(`Layanan: ${LAYANAN_MAP[booking.jenisLayanan] || booking.jenisLayanan}`);
    doc.text(`Jumlah Person: ${booking.jumlahPerson}`);
    if (booking.withKeyboard) {
      doc.text("Tambahan: Keyboard");
    }
    doc.moveDown(1);

    doc.fontSize(13).font("Helvetica-Bold").text("Pembayaran");
    doc.fontSize(11).font("Helvetica");
    doc.text(`Total: Rp ${booking.total.toLocaleString("id-ID")}`);
    doc.text(`Metode Pembayaran: ${PAYMENT_MAP[booking.paymentMethod] || booking.paymentMethod}`);
    doc.moveDown(0.5);
    doc.fontSize(12).font("Helvetica-Bold").text("Status: Lunas", { align: "left" });
    doc.moveDown(2);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(9).font("Helvetica").text("Terima kasih telah memilih Joel Music Studio!", { align: "center" });

    doc.end();

    const serverUrl = process.env.SERVER_URL || "";
    writeStream.on("finish", () => resolve(`${serverUrl}/invoices/${fileName}`));
    writeStream.on("error", reject);
  });
}

function isRamadan(): boolean {
  const now = new Date();
  const ramadanPeriods = [
    { start: new Date(2026, 1, 17), end: new Date(2026, 2, 19) },
    { start: new Date(2027, 1, 7), end: new Date(2027, 2, 9) },
    { start: new Date(2028, 0, 27), end: new Date(2028, 1, 26) },
  ];
  return ramadanPeriods.some((p) => now >= p.start && now <= p.end);
}

function calculatePrice(service: string, durasi: number, withKeyboard = false): number {
  const liveRecordPrice = isRamadan() ? 80000 : 100000;
  switch (service) {
    case "rehearsal": {
      const base = durasi === 3 ? 190000 : durasi * 65000;
      return base + (withKeyboard ? durasi * 10000 : 0);
    }
    case "karaoke":
      if (durasi === 2) return 100000;
      return durasi * 55000;
    case "live_recording":
      return durasi * liveRecordPrice;
    case "cover_lagu":
      return 500000;
    default:
      return durasi * 65000;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const invoicesDir = path.resolve(process.cwd(), "public", "invoices");
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const loginHandler = async (req: any, res: any) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username dan password wajib diisi" });
      }

      const [admin] = await db
        .select()
        .from(admins)
        .where(eq(admins.username, username));

      if (!admin) {
        return res.status(401).json({ message: "Username atau password salah" });
      }

      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Username atau password salah" });
      }

      req.session.adminId = admin.id;
      req.session.adminUsername = admin.username;

      req.session.save((err: any) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Gagal menyimpan sesi" });
        }
        return res.json({
          message: "Login berhasil",
          adminId: admin.id,
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login gagal" });
    }
  };

  app.post("/admin/login", loginHandler);
  app.post("/api/admin/login", loginHandler);

  app.get("/api/admin/me", (req, res) => {
    if (req.session.adminId) {
      return res.json({ id: req.session.adminId, username: req.session.adminUsername });
    }
    return res.status(401).json({ message: "Unauthorized" });
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Gagal logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Berhasil logout" });
    });
  });

  app.get("/api/bookings/schedule/:date", async (req, res) => {
    try {
      const { date } = req.params;
      const bookings = await storage.getBookingsByDate(date);
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  const bookingStatusQuerySchema = z.object({
    bookingIds: z.array(z.string()).min(1).max(100),
  });

  app.post("/api/bookings/status", async (req, res) => {
    try {
      const parsed = bookingStatusQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.json([]);
      }
      const statuses = await storage.getBookingStatusesByBookingIds(parsed.data.bookingIds);
      res.json(statuses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statuses" });
    }
  });

  app.post("/api/bookings", async (req, res) => {
    try {
      const parsed = insertBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Data tidak valid", errors: parsed.error.errors });
      }

      const { tanggal, jamMulai, durasi, jenisLayanan, withKeyboard } = parsed.data;

      const isAvailable = await storage.checkSlotAvailability(tanggal, jamMulai, durasi);
      if (!isAvailable) {
        return res.status(409).json({ message: "Slot waktu yang dipilih sudah tidak tersedia" });
      }

      const total = calculatePrice(jenisLayanan, durasi, withKeyboard);

      const dateParts = tanggal.split("-");
      const yy = dateParts[0].slice(2);
      const mm = dateParts[1];
      const dd = dateParts[2];
      const count = await storage.countBookingsByDate(tanggal);
      const seq = String(count + 1).padStart(2, "0");
      const bookingId = `${yy}${mm}${dd}-${seq}`;

      const booking = await storage.createBooking({ ...parsed.data, total, bookingId });
      res.status(201).json(booking);
    } catch (error) {
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

app.get("/api/admin/bookings/all", async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get("/api/admin/bookings/:date", async (req, res) => {
    try {
      const { date } = req.params;
      const bookings = await storage.getBookingsByDate(date);
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.patch("/api/admin/bookings/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!["confirmed", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Status tidak valid" });
      }

      const booking = await storage.updateBookingStatus(id, status);
      if (!booking) {
        return res.status(404).json({ message: "Booking tidak ditemukan" });
      }

      res.json(booking);
    } catch (error) {
      res.status(500).json({ message: "Failed to update booking status" });
    }
  });

  app.post("/api/admin/bookings/:id/approve", async (req, res) => {
    try {
      const { id } = req.params;

      const booking = await storage.getBookingById(id);
      if (!booking) {
        return res.status(404).json({ message: "Booking tidak ditemukan" });
      }
      if (booking.status !== "pending") {
        return res.status(400).json({ message: "Booking sudah diproses sebelumnya" });
      }

      await storage.updateBookingStatus(id, "confirmed");

      const invoiceUrl = await generateInvoicePDF(booking);
      await storage.updateBookingInvoiceUrl(id, invoiceUrl);

      const waNumber = formatWaNumber(booking.noWa);
      const tanggalStr = formatTanggal(booking.tanggal);
      const jamStr = formatJam(booking.jamMulai, booking.durasi);
      const layananStr = LAYANAN_MAP[booking.jenisLayanan] || booking.jenisLayanan;
      const metodeStr = PAYMENT_MAP[booking.paymentMethod] || booking.paymentMethod;

      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "";
      const fullInvoiceUrl = invoiceUrl.startsWith("http")
        ? invoiceUrl
        : `${protocol}://${host}${invoiceUrl}`;

      const message = `\u{1F3B5} JOEL MUSIC STUDIO\n\nHalo ${booking.namaBand} \u{1F44B}\n\nBooking kamu sudah dikonfirmasi \u2705\n\n\u{1F4CC} Booking ID: ${booking.bookingId || booking.id}\n\u{1F5D3}\uFE0F Tanggal: ${tanggalStr}\n\u23F0 Jam: ${jamStr}\n\u{1F3B8} Layanan: ${layananStr}\n\n\u{1F4B0} Total: Rp ${booking.total.toLocaleString("id-ID")}\nMetode Pembayaran: ${metodeStr}\n\n\u{1F9FE} Invoice:\n${fullInvoiceUrl}\n\nSilakan datang 10 menit sebelum jadwal \u{1F64F}\nTerima kasih!`;

      const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

      res.json({ success: true, whatsappUrl });
    } catch (error) {
      console.error("Approve error:", error);
      res.status(500).json({ message: "Gagal approve booking" });
    }
  });

  app.post("/api/admin/bookings/:id/reject", async (req, res) => {
    try {
      const { id } = req.params;

      const booking = await storage.getBookingById(id);
      if (!booking) {
        return res.status(404).json({ message: "Booking tidak ditemukan" });
      }
      if (booking.status !== "pending") {
        return res.status(400).json({ message: "Booking sudah diproses sebelumnya" });
      }

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

  app.delete("/api/admin/bookings/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const deleted = await storage.deleteBooking(id);

      if (!deleted) {
        return res.status(404).json({ message: "Booking tidak ditemukan" });
      }

      res.json({ message: "Booking berhasil dihapus" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Gagal menghapus booking" });
    }
  });

  app.get("/api/admin/costs/:date", async (req, res) => {
    try {
      const { date } = req.params;
      const costs = await storage.getCostsByDate(date);
      res.json(costs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch costs" });
    }
  });

  app.post("/api/admin/costs", async (req, res) => {
    try {
      const parsed = insertDailyCostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Data tidak valid", errors: parsed.error.errors });
      }

      const cost = await storage.createCost(parsed.data);
      res.status(201).json(cost);
    } catch (error) {
      res.status(500).json({ message: "Failed to create cost" });
    }
  });

  app.patch("/api/admin/costs/:id", async (req, res) => {
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
      if (!updated) {
        return res.status(404).json({ message: "Cost tidak ditemukan" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update cost" });
    }
  });

  app.delete("/api/admin/costs/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCost(id);
      if (!deleted) {
        return res.status(404).json({ message: "Cost tidak ditemukan" });
      }
      res.json({ message: "Cost berhasil dihapus" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete cost" });
    }
  });

  /* app.post("/api/upload/bukti", async (req, res) => {
  try {
    // sementara kita cuma return dummy response
    res.json({
      success: true,
      message: "Bukti berhasil diterima",
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to upload bukti" });
  }
}); */

app.post("/api/upload/bukti", async (req, res) => {
  try {
    const { bookingId, buktiUrl } = req.body;

    if (!bookingId || !buktiUrl) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    const updated = await storage.updateBookingBuktiTransfer(
      bookingId,
      buktiUrl
    );

    if (!updated) {
      return res.status(404).json({ message: "Booking tidak ditemukan" });
    }

    res.json({
      success: true,
      message: "Bukti berhasil disimpan",
      booking: updated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to upload bukti" });
  }
});

  return httpServer;
}
