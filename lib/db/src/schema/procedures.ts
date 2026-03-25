import { pgTable, serial, text, integer, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const proceduresTable = pgTable("procedures", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }).default("0"),
  description: text("description"),
  maxCapacity: integer("max_capacity").notNull().default(1),
  onlineBookingEnabled: boolean("online_booking_enabled").notNull().default(false),
  clinicId: integer("clinic_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProcedureSchema = createInsertSchema(proceduresTable).omit({ id: true, createdAt: true });
export type InsertProcedure = z.infer<typeof insertProcedureSchema>;
export type Procedure = typeof proceduresTable.$inferSelect;
