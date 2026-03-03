import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, date, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  namaBand: text("nama_band").notNull(),
  jumlahPerson: integer("jumlah_person").notNull(),
  noWa: text("no_wa").notNull(),
  jenisLayanan: text("jenis_layanan").notNull().default("rehearsal"),
  tanggal: date("tanggal").notNull(),
  jamMulai: integer("jam_mulai").notNull(),
  durasi: integer("durasi").notNull(),
  total: integer("total").notNull(),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method").notNull().default("transfer"),
  withKeyboard: boolean("with_keyboard").notNull().default(false),
  buktiTransfer: text("bukti_transfer"),
  bookingId: text("booking_id"),
  invoiceUrl: text("invoice_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dailyCost = pgTable("daily_cost", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tanggal: date("tanggal").notNull(),
  cost: integer("cost").notNull(),
  keterangan: text("keterangan").notNull(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  status: true,
  total: true,
  paymentMethod: true,
  bookingId: true,
  invoiceUrl: true,
});

export const insertDailyCostSchema = createInsertSchema(dailyCost).omit({
  id: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertDailyCost = z.infer<typeof insertDailyCostSchema>;
export type DailyCost = typeof dailyCost.$inferSelect;
