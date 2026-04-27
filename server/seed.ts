import { db } from "./db";
import { bookings, dailyCost, admins, services, additionalEquipment } from "@shared/schema";
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
      total: 500000,
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

export async function migrateInvoicePdf() {
  try {
    await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_pdf TEXT`);
    console.log("Migration: invoice_pdf column ensured");
  } catch (e) {
    console.log("Migration: invoice_pdf column already exists or error:", e);
  }
}

export async function migrateExtraServices() {
  try {
    await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS extra_services JSONB`);
    console.log("Migration: extra_services column ensured");
  } catch (e) {
    console.log("Migration: extra_services column already exists or error:", e);
  }
}

export async function migratePageViews() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS page_views (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        page TEXT NOT NULL,
        visited_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_page_views_visited_at ON page_views(visited_at)
    `);
    console.log("Migration: page_views table ensured");
  } catch (e) {
    console.log("Migration: page_views error:", e);
  }
}

export async function migrateGalleryItems() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gallery_items (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        image_url TEXT NOT NULL,
        band_name TEXT NOT NULL,
        service_type TEXT NOT NULL,
        quote TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT now()
      )
    `);
    console.log("Migration: gallery_items table ensured");
  } catch (e) {
    console.log("Migration: gallery_items error:", e);
  }
}

export async function migrateGalleryLikes() {
  try {
    await db.execute(sql`
      ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS likes INTEGER NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gallery_likes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        gallery_item_id VARCHAR NOT NULL,
        device_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_likes_unique ON gallery_likes(gallery_item_id, device_id)
    `);
    console.log("Migration: gallery_likes table ensured");
  } catch (e) {
    console.log("Migration: gallery_likes error:", e);
  }
}

export async function migratePushSubscriptions() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_username TEXT NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        subscription JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT now()
      )
    `);
    console.log("Migration: push_subscriptions table ensured");
  } catch (e) {
    console.log("Migration: push_subscriptions error:", e);
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

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn("ADMIN_PASSWORD env var not set — skipping admin seed");
    return;
  }

  const [existing] = await db
    .select()
    .from(admins)
    .where(eq(admins.username, adminUsername));

  const newHash = await bcrypt.hash(adminPassword, 10);
  if (!existing) {
    await db.insert(admins).values({
      username: adminUsername,
      passwordHash: newHash,
    });
    console.log("Admin seeded:", adminUsername);
  } else {
    const isSame = await bcrypt.compare(adminPassword, existing.passwordHash);
    if (!isSame) {
      await db.update(admins).set({ passwordHash: newHash }).where(eq(admins.username, adminUsername));
      console.log("Admin password updated");
    }
  }
}

export async function migrateAndSeedServices() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS services (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      is_fixed_price BOOLEAN NOT NULL DEFAULT false,
      fixed_price INTEGER,
      price_per_hour INTEGER,
      pricing_tiers JSONB,
      note TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  const existing = await db.select().from(services).limit(1);
  if (existing.length > 0) {
    console.log("Services already seeded");
    return;
  }

  await db.insert(services).values([
    {
      key: "rehearsal",
      name: "Rehearsal / Latihan",
      description: "Latihan band dengan alat lengkap",
      isActive: true,
      isFixedPrice: false,
      pricePerHour: 65000,
      pricingTiers: [{ hours: 3, price: 190000 }],
      note: null,
      sortOrder: 0,
    },
    {
      key: "karaoke",
      name: "Karaoke",
      description: "Karaoke dengan sound system profesional",
      isActive: true,
      isFixedPrice: false,
      pricePerHour: 55000,
      pricingTiers: [{ hours: 2, price: 100000 }],
      note: null,
      sortOrder: 1,
    },
    {
      key: "live_recording",
      name: "Live Record",
      description: "Rekaman live langsung di studio",
      isActive: true,
      isFixedPrice: false,
      pricePerHour: 100000,
      pricingTiers: [],
      note: "Per jam. Output: master lagu WAV",
      sortOrder: 2,
    },
    {
      key: "cover_lagu",
      name: "Cover Lagu / Minus One",
      description: "Cover lagu dengan tuning vocal & mixing",
      isActive: true,
      isFixedPrice: true,
      fixedPrice: 500000,
      pricePerHour: null,
      pricingTiers: [],
      note: "Maks 3 track vocal, 1x revisi, include tuning vocal & mixing. Output: master WAV + video",
      sortOrder: 3,
    },
  ]);

  console.log("Services seeded successfully");
}

export async function migrateAndSeedAdditionalEquipment() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS additional_equipment (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      price_per_hour INTEGER NOT NULL,
      service_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.execute(sql`
    ALTER TABLE additional_equipment ADD COLUMN IF NOT EXISTS service_keys JSONB NOT NULL DEFAULT '[]'::jsonb
  `);

  await db.execute(sql`
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS selected_equipment_ids JSONB NOT NULL DEFAULT '[]'::jsonb
  `);

  const existing = await db.select().from(additionalEquipment);
  
  if (existing.length === 0) {
    await db.insert(additionalEquipment).values([
      {
        name: "Keyboard",
        pricePerHour: 10000,
        serviceKeys: ["rehearsal"],
        isActive: true,
        sortOrder: 0,
      },
    ]);
    console.log("Additional equipment seeded successfully");
  } else {
    const keyboard = existing.find((e) => e.name === "Keyboard");
    if (keyboard && (!keyboard.serviceKeys || (Array.isArray(keyboard.serviceKeys) && keyboard.serviceKeys.length === 0))) {
      await db.update(additionalEquipment)
        .set({ serviceKeys: ["rehearsal"] })
        .where(eq(additionalEquipment.id, keyboard.id));
      console.log("Keyboard serviceKeys updated");
    } else {
      console.log("Additional equipment already seeded with correct data");
    }
  }
}

export async function migrateAppSettings() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    await db.execute(sql`
      INSERT INTO app_settings (key, value)
      VALUES ('minimalDP', '20000')
      ON CONFLICT (key) DO NOTHING
    `);
    console.log("Migration: app_settings table ensured");
  } catch (e) {
    console.log("Migration: app_settings error:", e);
  }
}

export async function seedOperationalSchedule() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS operational_schedule (
      day_of_week INTEGER PRIMARY KEY,
      is_open BOOLEAN NOT NULL DEFAULT true,
      open_hour INTEGER NOT NULL DEFAULT 9,
      close_hour INTEGER NOT NULL DEFAULT 23
    )
  `);

  const defaults = [
    { dayOfWeek: 0, isOpen: true, openHour: 9, closeHour: 24 },
    { dayOfWeek: 1, isOpen: true, openHour: 9, closeHour: 23 },
    { dayOfWeek: 2, isOpen: true, openHour: 9, closeHour: 23 },
    { dayOfWeek: 3, isOpen: true, openHour: 9, closeHour: 23 },
    { dayOfWeek: 4, isOpen: true, openHour: 9, closeHour: 23 },
    { dayOfWeek: 5, isOpen: true, openHour: 9, closeHour: 23 },
    { dayOfWeek: 6, isOpen: true, openHour: 9, closeHour: 24 },
  ];

  const { operationalSchedule } = await import("@shared/schema");
  const existing = await db.select().from(operationalSchedule);
  const existingDays = existing.map((s) => s.dayOfWeek);

  for (const d of defaults) {
    if (!existingDays.includes(d.dayOfWeek)) {
      await db.insert(operationalSchedule).values(d);
    }
  }
  console.log("Operational schedule seeded");
}
