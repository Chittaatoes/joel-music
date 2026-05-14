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

export type ExtraServiceItem = {
  key: string;
  name: string;
  tanggal?: string;
  jamMulai: number;
  durasi: number;
  selectedEquipmentIds: string[];
  withKeyboard: boolean;
  subtotal: number;
};

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
  selectedEquipmentIds: jsonb("selected_equipment_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  buktiTransfer: text("bukti_transfer"),
  bookingId: text("booking_id"),
  invoiceUrl: text("invoice_url"),
  invoicePdf: text("invoice_pdf"),
  extraServices: jsonb("extra_services").$type<ExtraServiceItem[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dailyCost = pgTable("daily_cost", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tanggal: date("tanggal").notNull(),
  cost: integer("cost").notNull(),
  keterangan: text("keterangan").notNull(),
});

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  isFixedPrice: boolean("is_fixed_price").notNull().default(false),
  fixedPrice: integer("fixed_price"),
  pricePerHour: integer("price_per_hour"),
  pricingTiers: jsonb("pricing_tiers").$type<{ hours: number; price: number }[]>(),
  note: text("note"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const additionalEquipment = pgTable("additional_equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  pricePerHour: integer("price_per_hour").notNull(),
  serviceKeys: jsonb("service_keys").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const operationalSchedule = pgTable("operational_schedule", {
  dayOfWeek: integer("day_of_week").primaryKey(),
  isOpen: boolean("is_open").notNull().default(true),
  openHour: integer("open_hour").notNull().default(9),
  closeHour: integer("close_hour").notNull().default(23),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUsername: text("admin_username").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  subscription: jsonb("subscription").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const galleryItems = pgTable("gallery_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageUrl: text("image_url").notNull(),
  bandName: text("band_name").notNull(),
  serviceType: text("service_type").notNull(),
  quote: text("quote"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGalleryItemSchema = createInsertSchema(galleryItems).omit({
  id: true,
  createdAt: true,
  likes: true,
});

export type GalleryItem = typeof galleryItems.$inferSelect;
export type InsertGalleryItem = z.infer<typeof insertGalleryItemSchema>;

export const galleryLikes = pgTable("gallery_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  galleryItemId: varchar("gallery_item_id").notNull(),
  deviceId: text("device_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  status: true,
  total: true,
  paymentMethod: true,
  bookingId: true,
  invoiceUrl: true,
}).extend({
  extraServices: z.array(z.object({
    key: z.string(),
    name: z.string(),
    jamMulai: z.number(),
    durasi: z.number(),
    selectedEquipmentIds: z.array(z.string()).default([]),
    withKeyboard: z.boolean().default(false),
    subtotal: z.number(),
  })).optional().nullable(),
});

export const insertDailyCostSchema = createInsertSchema(dailyCost).omit({
  id: true,
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
});

export const updateServiceSchema = insertServiceSchema.partial();

export const insertAdditionalEquipmentSchema = createInsertSchema(additionalEquipment).omit({
  id: true,
}).extend({
  serviceKeys: z.array(z.string()).default([]),
});

export const updateAdditionalEquipmentSchema = insertAdditionalEquipmentSchema.partial();

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertDailyCost = z.infer<typeof insertDailyCostSchema>;
export type DailyCost = typeof dailyCost.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;
export type InsertAdditionalEquipment = z.infer<typeof insertAdditionalEquipmentSchema>;
export type AdditionalEquipment = typeof additionalEquipment.$inferSelect;
export type PricingTier = { hours: number; price: number };
export type OperationalSchedule = typeof operationalSchedule.$inferSelect;

export const pageViews = pgTable("page_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  page: text("page").notNull(),
  visitedAt: timestamp("visited_at").defaultNow().notNull(),
});

export type PageView = typeof pageViews.$inferSelect;

export const appSettings = pgTable("app_settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;

export type MenuOptionGroup = {
  key: string;
  label: string;
  type: "select" | "toggle";
  choices?: string[];
  priceAdd?: number;
};

export const foodMenu = pgTable("food_menu", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  category: text("category").notNull().default("minuman"),
  emoji: text("emoji").notNull().default("🍽️"),
  isActive: boolean("is_active").notNull().default(true),
  options: jsonb("options").$type<MenuOptionGroup[]>().notNull().default(sql`'[]'::jsonb`),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertFoodMenuSchema = createInsertSchema(foodMenu).omit({ id: true });
export type FoodMenuItem = typeof foodMenu.$inferSelect;
export type InsertFoodMenuItem = z.infer<typeof insertFoodMenuSchema>;

export type FoodOrderItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  emoji: string;
  selectedOptions?: Record<string, string>;
};

export const foodOrders = pgTable("food_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  namaBand: text("nama_band").notNull(),
  items: jsonb("items").$type<FoodOrderItem[]>().notNull(),
  total: integer("total").notNull(),
  servingTime: text("serving_time").notNull().default("sekarang"),
  paymentMethod: text("payment_method").notNull().default("cash"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFoodOrderSchema = createInsertSchema(foodOrders).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type FoodOrder = typeof foodOrders.$inferSelect;
export type InsertFoodOrder = z.infer<typeof insertFoodOrderSchema>;
