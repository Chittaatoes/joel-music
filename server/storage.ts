import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  bookings,
  dailyCost,
  type Booking,
  type InsertBooking,
  type DailyCost,
  type InsertDailyCost,
} from "@shared/schema";

export interface IStorage {
  createBooking(data: InsertBooking & { total: number; paymentMethod?: string; buktiTransfer?: string; withKeyboard?: boolean; bookingId?: string }): Promise<Booking>;
  getBookingsByDate(tanggal: string): Promise<Booking[]>;
  getAllBookings(): Promise<Booking[]>;
  getBookingById(id: string): Promise<Booking | undefined>;
  getBookingStatusesByBookingIds(bookingIds: string[]): Promise<{ bookingId: string; status: string }[]>;
  getConfirmedBookingsByDate(tanggal: string): Promise<Booking[]>;
  countBookingsByDate(tanggal: string): Promise<number>;
  updateBookingStatus(id: string, status: string): Promise<Booking | undefined>;
  updateBookingBuktiTransfer(id: string, buktiTransfer: string): Promise<Booking | undefined>;
  updateBookingInvoiceUrl(id: string, invoiceUrl: string): Promise<Booking | undefined>;
  checkSlotAvailability(tanggal: string, jamMulai: number, durasi: number): Promise<boolean>;
  getCostsByDate(tanggal: string): Promise<DailyCost[]>;
  createCost(data: InsertDailyCost): Promise<DailyCost>;
  updateCost(id: string, data: Partial<InsertDailyCost>): Promise<DailyCost | undefined>;
  deleteCost(id: string): Promise<boolean>;
  deleteBooking(id: string): Promise<boolean>;
}

class DatabaseStorage implements IStorage {
  async createBooking(data: InsertBooking & { total: number; paymentMethod?: string; buktiTransfer?: string; withKeyboard?: boolean; bookingId?: string }): Promise<Booking> {
    const [booking] = await db
      .insert(bookings)
      .values({
        namaBand: data.namaBand,
        jumlahPerson: data.jumlahPerson,
        noWa: data.noWa,
        jenisLayanan: data.jenisLayanan,
        tanggal: data.tanggal,
        jamMulai: data.jamMulai,
        durasi: data.durasi,
        total: data.total,
        status: "pending",
        paymentMethod: data.paymentMethod || "transfer",
        withKeyboard: data.withKeyboard || false,
        buktiTransfer: data.buktiTransfer || null,
        bookingId: data.bookingId || null,
      })
      .returning();
    return booking;
  }

  async getBookingsByDate(tanggal: string): Promise<Booking[]> {
    return db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.tanggal, tanggal),
          sql`${bookings.status} IN ('pending', 'confirmed')`
        )
      );
  }

  async getAllBookings(): Promise<Booking[]> {
    return db
      .select()
      .from(bookings)
      .orderBy(sql`${bookings.createdAt} DESC`);
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, id));
    return booking;
  }

  async getBookingStatusesByBookingIds(bookingIds: string[]): Promise<{ bookingId: string; status: string }[]> {
    if (bookingIds.length === 0) return [];
    const results = await db
      .select({ bookingId: bookings.bookingId, status: bookings.status })
      .from(bookings)
      .where(inArray(bookings.bookingId, bookingIds));
    return results.filter((r): r is { bookingId: string; status: string } => r.bookingId !== null);
  }

  async countBookingsByDate(tanggal: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(eq(bookings.tanggal, tanggal));
    return Number(result[0]?.count || 0);
  }

  async getConfirmedBookingsByDate(tanggal: string): Promise<Booking[]> {
    return db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.tanggal, tanggal),
          eq(bookings.status, "confirmed")
        )
      );
  }

  async updateBookingStatus(id: string, status: string): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set({ status })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async updateBookingBuktiTransfer(id: string, buktiTransfer: string): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set({ buktiTransfer })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async updateBookingInvoiceUrl(id: string, invoiceUrl: string): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set({ invoiceUrl })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async checkSlotAvailability(tanggal: string, jamMulai: number, durasi: number): Promise<boolean> {
    const existingBookings = await this.getBookingsByDate(tanggal);
    const requestedEnd = jamMulai + durasi;

    for (const b of existingBookings) {
      const existingEnd = b.jamMulai + b.durasi;
      if (jamMulai < existingEnd && requestedEnd > b.jamMulai) {
        return false;
      }
    }
    return true;
  }

  async getCostsByDate(tanggal: string): Promise<DailyCost[]> {
    return db
      .select()
      .from(dailyCost)
      .where(eq(dailyCost.tanggal, tanggal));
  }

  async createCost(data: InsertDailyCost): Promise<DailyCost> {
    const [cost] = await db
      .insert(dailyCost)
      .values(data)
      .returning();
    return cost;
  }

  async updateCost(id: string, data: Partial<InsertDailyCost>): Promise<DailyCost | undefined> {
    const [cost] = await db
      .update(dailyCost)
      .set(data)
      .where(eq(dailyCost.id, id))
      .returning();
    return cost;
  }

  async deleteCost(id: string): Promise<boolean> {
    const result = await db
      .delete(dailyCost)
      .where(eq(dailyCost.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteBooking(id: string): Promise<boolean> {
    const result = await db
      .delete(bookings)
      .where(eq(bookings.id, id))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
