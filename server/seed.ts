import { db } from "./db";
import { bookings, dailyCost, admins } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import { format, addDays } from "date-fns";
import bcrypt from "bcryptjs";

export async function seedDatabase() {
  if (process.env.NODE_ENV === "production") return;
  const existingBookings = await db.select().from(bookings).limit(1);
  if (existingBookings.length > 0) return;

  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  await db.insert(bookings).values([
    {
      namaBand: "Nirwana Project",
      jumlahPerson: 4,
      noWa: "081234567890",
      jenisLayanan: "rehearsal",
      tanggal: today,
      jamMulai: 14,
      durasi: 2,
      total: 120000,
      status: "confirmed",
    },
    {
      namaBand: "The Midnight Sun",
      jumlahPerson: 5,
      noWa: "082345678901",
      jenisLayanan: "karaoke",
      tanggal: today,
      jamMulai: 17,
      durasi: 2,
      total: 100000,
      status: "pending",
    },
    {
      namaBand: "Acoustic Vibes",
      jumlahPerson: 3,
      noWa: "083456789012",
      jenisLayanan: "live_recording",
      tanggal: today,
      jamMulai: 10,
      durasi: 2,
      total: 160000,
      status: "confirmed",
    },
    {
      namaBand: "Rock Solid",
      jumlahPerson: 6,
      noWa: "084567890123",
      jenisLayanan: "cover_lagu",
      tanggal: tomorrow,
      jamMulai: 13,
      durasi: 1,
      total: 300000,
      status: "pending",
    },
  ]);

  await db.insert(dailyCost).values([
    {
      tanggal: today,
      cost: 50000,
      keterangan: "Listrik & AC",
    },
    {
      tanggal: today,
      cost: 30000,
      keterangan: "Maintenance alat musik",
    },
  ]);

  console.log("Database seeded successfully");
}

export async function migrateBookingId() {
  try {
    await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_id TEXT`);
    console.log("Migration: booking_id column ensured");
  } catch (e) {
    console.log("Migration: booking_id column already exists or error:", e);
  }
}

export async function migrateInvoiceUrl() {
  try {
    await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_url TEXT`);
    console.log("Migration: invoice_url column ensured");
  } catch (e) {
    console.log("Migration: invoice_url column already exists or error:", e);
  }
}

export async function seedAdminTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admins (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT now()
    )
  `);

  const [existing] = await db
    .select()
    .from(admins)
    .where(eq(admins.username, "admin"));

  const newHash = await bcrypt.hash("Joelmusicstudio26", 10);
  if (!existing) {
    await db.insert(admins).values({
      username: "admin",
      passwordHash: newHash,
    });
    console.log("Admin seeded: admin");
  } else {
    const isSame = await bcrypt.compare("Joelmusicstudio26", existing.passwordHash);
    if (!isSame) {
      await db.update(admins).set({ passwordHash: newHash }).where(eq(admins.username, "admin"));
      console.log("Admin password updated");
    }
  }
}
