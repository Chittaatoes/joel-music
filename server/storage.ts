import { eq, and, sql, inArray, gte, lte, lt, isNotNull } from "drizzle-orm";
import { db } from "./db";
import {
  bookings,
  dailyCost,
  services,
  additionalEquipment,
  operationalSchedule,
  galleryItems,
  galleryLikes,
  pushSubscriptions,
  pageViews,
  appSettings,
  type Booking,
  type InsertBooking,
  type DailyCost,
  type InsertDailyCost,
  type Service,
  type InsertService,
  type AdditionalEquipment,
  type InsertAdditionalEquipment,
  type OperationalSchedule,
  type GalleryItem,
  type InsertGalleryItem,
} from "@shared/schema";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function getJakartaNow() {
  return new Date(Date.now() + JAKARTA_OFFSET_MS);
}

function getJakartaDayBounds(date = new Date()) {
  const jakartaNow = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  const startOfDay = new Date(Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth(), jakartaNow.getUTCDate(), 0, 0, 0));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  return {
    start: new Date(startOfDay.getTime() - JAKARTA_OFFSET_MS),
    end: new Date(endOfDay.getTime() - JAKARTA_OFFSET_MS),
    dateKey: startOfDay.toISOString().slice(0, 10),
  };
}

export interface IStorage {
  createBooking(data: InsertBooking & { total: number; paymentMethod?: string; buktiTransfer?: string; withKeyboard?: boolean; bookingId?: string }): Promise<Booking>;
  getBookingsByDate(tanggal: string): Promise<Booking[]>;
  getBookingsByDateRange(from: string, to: string): Promise<Booking[]>;
  getAllBookings(): Promise<Booking[]>;
  getBookingById(id: string): Promise<Booking | undefined>;
  getBookingStatusesByBookingIds(bookingIds: string[]): Promise<{ bookingId: string; status: string }[]>;
  getConfirmedBookingsByDate(tanggal: string): Promise<Booking[]>;
  countBookingsByDate(tanggal: string): Promise<number>;
  updateBookingStatus(id: string, status: string): Promise<Booking | undefined>;
  updateBookingBuktiTransfer(id: string, buktiTransfer: string): Promise<Booking | undefined>;
  updateBookingInvoiceUrl(id: string, invoiceUrl: string): Promise<Booking | undefined>;
  saveInvoicePdf(id: string, invoiceUrl: string, pdfBase64: string): Promise<void>;
  getInvoicePdfByBookingId(bookingId: string): Promise<string | null>;
  cleanupOldInvoicePdfs(): Promise<number>;
  checkSlotAvailability(tanggal: string, jamMulai: number, durasi: number): Promise<boolean>;
  getOperationalSchedule(): Promise<OperationalSchedule[]>;
  upsertOperationalSchedule(data: OperationalSchedule): Promise<OperationalSchedule>;
  createDailyCost(data: InsertDailyCost): Promise<DailyCost>;
  updateDailyCost(id: string, data: Partial<InsertDailyCost>): Promise<DailyCost | undefined>;
  deleteDailyCost(id: string): Promise<boolean>;
  getDailyCostsByDateRange(from: string, to: string): Promise<DailyCost[]>;
  getAllServices(): Promise<Service[]>;
  createService(data: InsertService): Promise<Service>;
  updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<boolean>;
  getServiceByKey(key: string): Promise<Service | undefined>;
  getAdditionalEquipment(): Promise<AdditionalEquipment[]>;
  createAdditionalEquipment(data: InsertAdditionalEquipment): Promise<AdditionalEquipment>;
  updateAdditionalEquipment(id: string, data: Partial<InsertAdditionalEquipment>): Promise<AdditionalEquipment | undefined>;
  deleteAdditionalEquipment(id: string): Promise<boolean>;
  getGalleryItems(): Promise<GalleryItem[]>;
  createGalleryItem(data: InsertGalleryItem): Promise<GalleryItem>;
  deleteGalleryItem(id: string): Promise<boolean>;
  toggleGalleryLike(itemId: string, deviceId: string): Promise<{ liked: boolean; total: number }>;
  getGalleryLikedIds(deviceId: string): Promise<string[]>;
  getBookingsByBookingId(bookingId: string): Promise<Booking[]>;
  getAllBookingsSorted(): Promise<Booking[]>;
  getAllBookingsWithStatus(status: string): Promise<Booking[]>;
  getBookingByBookingId(bookingId: string): Promise<Booking | undefined>;
  getConfirmedBandSuggestions(limit?: number): Promise<string[]>;
  savePushSubscription(adminUsername: string, endpoint: string, subscription: any): Promise<void>;
  deletePushSubscription(endpoint: string): Promise<void>;
  getAllPushSubscriptions(): Promise<{ endpoint: string; subscription: any }[]>;
  getActiveServices(): Promise<Service[]>;
  getServices(): Promise<Service[]>;
  updateOperationalScheduleDay(dayOfWeek: number, data: Partial<Pick<OperationalSchedule, "isOpen" | "openHour" | "closeHour">>): Promise<OperationalSchedule | undefined>;
  getCostsByDate(tanggal: string): Promise<DailyCost[]>;
  getCostsByDateRange(from: string, to: string): Promise<DailyCost[]>;
  createCost(data: InsertDailyCost): Promise<DailyCost>;
  updateCost(id: string, data: Partial<InsertDailyCost>): Promise<DailyCost | undefined>;
  deleteCost(id: string): Promise<boolean>;
  deleteBooking(id: string): Promise<boolean>;
  trackPageView(page: string): Promise<void>;
  getPageViewStats(): Promise<{
    today: number;
    week: number;
    month: number;
    total: number;
    byPage: { page: string; count: number }[];
    dailyLast7: { date: string; count: number }[];
    weeklyHomepage: { date: string; count: number; dayLabel: string }[];
  }>;
  getHourlyStats(): Promise<{
    homepage: { hour: number; count: number }[];
    booking: { hour: number; count: number }[];
  }>;
  getSetting(key: string): Promise<string | null>;
  upsertSetting(key: string, value: string): Promise<void>;
}

class DatabaseStorage implements IStorage {
  async createBooking(data: InsertBooking & { total: number; paymentMethod?: string; buktiTransfer?: string; withKeyboard?: boolean; bookingId?: string }): Promise<Booking> {
    const [row] = await db.insert(bookings).values(data).returning();
    return row;
  }

  async getBookingsByDate(tanggal: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.tanggal, tanggal));
  }

  async getBookingsByDateRange(from: string, to: string): Promise<Booking[]> {
    return db.select().from(bookings).where(and(gte(bookings.tanggal, from), lte(bookings.tanggal, to)));
  }

  async getAllBookings(): Promise<Booking[]> {
    return db.select().from(bookings);
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
    return row;
  }

  async getBookingStatusesByBookingIds(bookingIds: string[]): Promise<{ bookingId: string; status: string }[]> {
    const rows = await db.select({ bookingId: bookings.bookingId, status: bookings.status }).from(bookings).where(inArray(bookings.bookingId, bookingIds));
    return rows;
  }

  async getConfirmedBookingsByDate(tanggal: string): Promise<Booking[]> {
    return db.select().from(bookings).where(and(eq(bookings.tanggal, tanggal), eq(bookings.status, "confirmed")));
  }

  async countBookingsByDate(tanggal: string): Promise<number> {
    const rows = await db.select({ count: sql<number>`count(*)::int` }).from(bookings).where(eq(bookings.tanggal, tanggal));
    return rows[0]?.count ?? 0;
  }

  async updateBookingStatus(id: string, status: string): Promise<Booking | undefined> {
    const [row] = await db.update(bookings).set({ status }).where(eq(bookings.id, id)).returning();
    return row;
  }

  async updateBookingBuktiTransfer(id: string, buktiTransfer: string): Promise<Booking | undefined> {
    const [row] = await db.update(bookings).set({ buktiTransfer }).where(eq(bookings.id, id)).returning();
    return row;
  }

  async updateBookingInvoiceUrl(id: string, invoiceUrl: string): Promise<Booking | undefined> {
    const [row] = await db.update(bookings).set({ invoiceUrl }).where(eq(bookings.id, id)).returning();
    return row;
  }

  async saveInvoicePdf(id: string, invoiceUrl: string, pdfBase64: string): Promise<void> {
    await db.update(bookings).set({ invoiceUrl, invoicePdf: pdfBase64 }).where(eq(bookings.id, id));
  }

  async getInvoicePdfByBookingId(bookingId: string): Promise<string | null> {
    const [row] = await db.select({ invoicePdf: bookings.invoicePdf }).from(bookings).where(eq(bookings.bookingId, bookingId));
    return row?.invoicePdf ?? null;
  }

  async cleanupOldInvoicePdfs(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const result = await db.update(bookings).set({ invoicePdf: null }).where(and(isNotNull(bookings.invoicePdf), lt(bookings.createdAt, cutoff)));
    return result.rowCount ?? 0;
  }

  async checkSlotAvailability(tanggal: string, jamMulai: number, durasi: number): Promise<boolean> {
    const rows = await db.select().from(bookings).where(eq(bookings.tanggal, tanggal));
    for (const row of rows) {
      if (!(jamMulai + durasi <= row.jamMulai || jamMulai >= row.jamMulai + row.durasi)) {
        return false;
      }
      const extraServices = (row.extraServices as any[] | null) || [];
      for (const svc of extraServices) {
        const svcTanggal = svc.tanggal || tanggal;
        if (svcTanggal !== tanggal) continue;
        if (!(jamMulai + durasi <= svc.jamMulai || jamMulai >= svc.jamMulai + svc.durasi)) {
          return false;
        }
      }
    }
    return true;
  }

  async getOperationalSchedule(): Promise<OperationalSchedule[]> {
    return db.select().from(operationalSchedule);
  }

  async upsertOperationalSchedule(data: OperationalSchedule): Promise<OperationalSchedule> {
    const [row] = await db.insert(operationalSchedule).values(data).onConflictDoUpdate({ target: operationalSchedule.dayOfWeek, set: data }).returning();
    return row;
  }

  async createDailyCost(data: InsertDailyCost): Promise<DailyCost> {
    const [row] = await db.insert(dailyCost).values(data).returning();
    return row;
  }

  async updateDailyCost(id: string, data: Partial<InsertDailyCost>): Promise<DailyCost | undefined> {
    const [row] = await db.update(dailyCost).set(data).where(eq(dailyCost.id, id)).returning();
    return row;
  }

  async deleteDailyCost(id: string): Promise<boolean> {
    const result = await db.delete(dailyCost).where(eq(dailyCost.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getDailyCostsByDateRange(from: string, to: string): Promise<DailyCost[]> {
    return db.select().from(dailyCost).where(and(gte(dailyCost.tanggal, from), lte(dailyCost.tanggal, to)));
  }

  async getAllServices(): Promise<Service[]> {
    return db.select().from(services);
  }

  async createService(data: InsertService): Promise<Service> {
    const [row] = await db.insert(services).values(data).returning();
    return row;
  }

  async updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined> {
    const [row] = await db.update(services).set(data).where(eq(services.id, id)).returning();
    return row;
  }

  async deleteService(id: string): Promise<boolean> {
    const result = await db.delete(services).where(eq(services.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getServiceByKey(key: string): Promise<Service | undefined> {
    const [row] = await db.select().from(services).where(eq(services.key, key));
    return row;
  }

  async getAdditionalEquipment(): Promise<AdditionalEquipment[]> {
    return db.select().from(additionalEquipment);
  }

  async createAdditionalEquipment(data: InsertAdditionalEquipment): Promise<AdditionalEquipment> {
    const [row] = await db.insert(additionalEquipment).values(data).returning();
    return row;
  }

  async updateAdditionalEquipment(id: string, data: Partial<InsertAdditionalEquipment>): Promise<AdditionalEquipment | undefined> {
    const [row] = await db.update(additionalEquipment).set(data).where(eq(additionalEquipment.id, id)).returning();
    return row;
  }

  async deleteAdditionalEquipment(id: string): Promise<boolean> {
    const result = await db.delete(additionalEquipment).where(eq(additionalEquipment.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getGalleryItems(): Promise<GalleryItem[]> {
    return db.select().from(galleryItems);
  }

  async createGalleryItem(data: InsertGalleryItem): Promise<GalleryItem> {
    const [row] = await db.insert(galleryItems).values(data).returning();
    return row;
  }

  async deleteGalleryItem(id: string): Promise<boolean> {
    const result = await db.delete(galleryItems).where(eq(galleryItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async toggleGalleryLike(itemId: string, deviceId: string): Promise<{ liked: boolean; total: number }> {
    const existing = await db
      .select()
      .from(galleryLikes)
      .where(and(eq(galleryLikes.galleryItemId, itemId), eq(galleryLikes.deviceId, deviceId)))
      .limit(1);

    let liked: boolean;
    if (existing.length > 0) {
      await db
        .delete(galleryLikes)
        .where(and(eq(galleryLikes.galleryItemId, itemId), eq(galleryLikes.deviceId, deviceId)));
      await db
        .update(galleryItems)
        .set({ likes: sql`GREATEST(likes - 1, 0)` })
        .where(eq(galleryItems.id, itemId));
      liked = false;
    } else {
      await db.insert(galleryLikes).values({ galleryItemId: itemId, deviceId });
      await db
        .update(galleryItems)
        .set({ likes: sql`likes + 1` })
        .where(eq(galleryItems.id, itemId));
      liked = true;
    }

    const [updated] = await db.select({ likes: galleryItems.likes }).from(galleryItems).where(eq(galleryItems.id, itemId));
    return { liked, total: updated?.likes ?? 0 };
  }

  async getGalleryLikedIds(deviceId: string): Promise<string[]> {
    const rows = await db
      .select({ galleryItemId: galleryLikes.galleryItemId })
      .from(galleryLikes)
      .where(eq(galleryLikes.deviceId, deviceId));
    return rows.map((r) => r.galleryItemId);
  }

  async getBookingsByBookingId(bookingId: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.bookingId, bookingId));
  }

  async getAllBookingsSorted(): Promise<Booking[]> {
    return db.select().from(bookings);
  }

  async getAllBookingsWithStatus(status: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.status, status));
  }

  async getBookingByBookingId(bookingId: string): Promise<Booking | undefined> {
    const [row] = await db.select().from(bookings).where(eq(bookings.bookingId, bookingId));
    return row;
  }

  async getConfirmedBandSuggestions(limit = 2): Promise<string[]> {
    const rows = await db.selectDistinct({ bandName: bookings.namaBand }).from(bookings).where(eq(bookings.status, "confirmed")).limit(limit);
    return rows.map((r) => r.bandName);
  }

  async savePushSubscription(adminUsername: string, endpoint: string, subscription: any): Promise<void> {
    await db.insert(pushSubscriptions)
      .values({ adminUsername, endpoint, subscription })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { subscription, adminUsername } });
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async getAllPushSubscriptions(): Promise<{ endpoint: string; subscription: any }[]> {
    const rows = await db.select({ endpoint: pushSubscriptions.endpoint, subscription: pushSubscriptions.subscription }).from(pushSubscriptions);
    return rows;
  }

  async getActiveServices(): Promise<Service[]> {
    return db.select().from(services).where(eq(services.isActive, true)).orderBy(services.sortOrder);
  }

  async getServices(): Promise<Service[]> {
    return db.select().from(services).orderBy(services.sortOrder);
  }

  async updateOperationalScheduleDay(dayOfWeek: number, data: Partial<Pick<OperationalSchedule, "isOpen" | "openHour" | "closeHour">>): Promise<OperationalSchedule | undefined> {
    const [row] = await db.update(operationalSchedule).set(data).where(eq(operationalSchedule.dayOfWeek, dayOfWeek)).returning();
    return row;
  }

  async getCostsByDate(tanggal: string): Promise<DailyCost[]> {
    return db.select().from(dailyCost).where(eq(dailyCost.tanggal, tanggal));
  }

  async getCostsByDateRange(from: string, to: string): Promise<DailyCost[]> {
    return db.select().from(dailyCost).where(and(gte(dailyCost.tanggal, from), lte(dailyCost.tanggal, to)));
  }

  async createCost(data: InsertDailyCost): Promise<DailyCost> {
    const [row] = await db.insert(dailyCost).values(data).returning();
    return row;
  }

  async updateCost(id: string, data: Partial<InsertDailyCost>): Promise<DailyCost | undefined> {
    const [row] = await db.update(dailyCost).set(data).where(eq(dailyCost.id, id)).returning();
    return row;
  }

  async deleteCost(id: string): Promise<boolean> {
    const result = await db.delete(dailyCost).where(eq(dailyCost.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteBooking(id: string): Promise<boolean> {
    const result = await db.delete(bookings).where(eq(bookings.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async trackPageView(page: string): Promise<void> {
    await db.insert(pageViews).values({ page, visitedAt: getJakartaNow() });
  }

  async getPageViewStats(): Promise<{
    today: number;
    week: number;
    month: number;
    total: number;
    byPage: { page: string; count: number }[];
    dailyLast7: { date: string; count: number }[];
  }> {
    const now = getJakartaNow();
    const todayBounds = getJakartaDayBounds(now);
    const weekStart = new Date(todayBounds.start);
    weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const monthStartJakarta = new Date(monthStart.getTime() - JAKARTA_OFFSET_MS);

    const [todayRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(pageViews)
      .where(and(gte(pageViews.visitedAt, todayBounds.start), lt(pageViews.visitedAt, todayBounds.end)));

    const [weekRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(pageViews)
      .where(gte(pageViews.visitedAt, weekStart));

    const [monthRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(pageViews)
      .where(gte(pageViews.visitedAt, monthStartJakarta));

    const [totalRow] = await db.select({ count: sql<number>`count(*)::int` }).from(pageViews);

    const byPageRows = await db
      .select({ page: pageViews.page, count: sql<number>`count(*)::int` })
      .from(pageViews)
      .where(gte(pageViews.visitedAt, weekStart))
      .groupBy(pageViews.page)
      .orderBy(sql`count(*) DESC`);

    const dailyRows = await db
      .select({
        date: sql<string>`to_char((visited_at + interval '7 hour')::date, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(gte(pageViews.visitedAt, weekStart))
      .groupBy(sql`(visited_at + interval '7 hour')::date`)
      .orderBy(sql`(visited_at + interval '7 hour')::date`);

    const dailyMap = new Map((dailyRows as any[]).map((row) => [row.date, Number(row.count)]));
    const dailyLast7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayBounds.start);
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return { date: key, count: dailyMap.get(key) ?? 0 };
    });

    const jakartaDayOfWeek = now.getUTCDay();
    const daysFromMonday = (jakartaDayOfWeek + 6) % 7;
    const mondayStart = new Date(todayBounds.start.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
    const sundayEnd = new Date(mondayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const homepageWeekRows = await db
      .select({
        date: sql<string>`to_char((visited_at + interval '7 hour')::date, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(and(gte(pageViews.visitedAt, mondayStart), lt(pageViews.visitedAt, sundayEnd), eq(pageViews.page, "/")))
      .groupBy(sql`(visited_at + interval '7 hour')::date`)
      .orderBy(sql`(visited_at + interval '7 hour')::date`);

    const homepageMap = new Map((homepageWeekRows as any[]).map((r) => [r.date, Number(r.count)]));
    const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const weeklyHomepage = Array.from({ length: 7 }, (_, i) => {
      const utcMs = mondayStart.getTime() + i * 24 * 60 * 60 * 1000;
      const jakartaDate = new Date(utcMs + JAKARTA_OFFSET_MS);
      const key = jakartaDate.toISOString().slice(0, 10);
      const dow = (1 + i) % 7;
      return { date: key, count: homepageMap.get(key) ?? 0, dayLabel: DAY_LABELS[dow] };
    });

    return {
      today: todayRow?.count ?? 0,
      week: weekRow?.count ?? 0,
      month: monthRow?.count ?? 0,
      total: totalRow?.count ?? 0,
      byPage: byPageRows.map((r) => ({ page: r.page, count: r.count })),
      dailyLast7,
      weeklyHomepage,
    };
  }

  async getHourlyStats(): Promise<{
    homepage: { hour: number; count: number }[];
    booking: { hour: number; count: number }[];
  }> {
    const toHourRows = async (page: string) => {
      const rows = await db
        .select({
          hour: sql<number>`EXTRACT(HOUR FROM (visited_at + interval '7 hours'))::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(pageViews)
        .where(eq(pageViews.page, page))
        .groupBy(sql`EXTRACT(HOUR FROM (visited_at + interval '7 hours'))`)
        .orderBy(sql`EXTRACT(HOUR FROM (visited_at + interval '7 hours'))`);
      return rows.map((r) => ({ hour: Number(r.hour), count: Number(r.count) }));
    };

    const [homepage, booking] = await Promise.all([
      toHourRows("/"),
      toHourRows("/booking"),
    ]);

    return { homepage, booking };
  }

  async getSetting(key: string): Promise<string | null> {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return row?.value ?? null;
  }

  async upsertSetting(key: string, value: string): Promise<void> {
    await db.insert(appSettings).values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } });
  }
}

export const storage = new DatabaseStorage();
