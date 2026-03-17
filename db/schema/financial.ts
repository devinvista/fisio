import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { appointmentsTable } from "./appointments";

export const financialRecordsTable = pgTable("financial_records", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  category: text("category"),
  appointmentId: integer("appointment_id").references(() => appointmentsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFinancialRecordSchema = createInsertSchema(financialRecordsTable).omit({ id: true, createdAt: true });
export type InsertFinancialRecord = z.infer<typeof insertFinancialRecordSchema>;
export type FinancialRecord = typeof financialRecordsTable.$inferSelect;
