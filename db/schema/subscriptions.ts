import { pgTable, serial, text, integer, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { proceduresTable } from "./procedures";

export const patientSubscriptionsTable = pgTable("patient_subscriptions", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  procedureId: integer("procedure_id").notNull().references(() => proceduresTable.id),
  startDate: date("start_date").notNull(),
  billingDay: integer("billing_day").notNull(),
  monthlyAmount: numeric("monthly_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("ativa"),
  clinicId: integer("clinic_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPatientSubscriptionSchema = createInsertSchema(patientSubscriptionsTable).omit({ id: true, createdAt: true });
export type InsertPatientSubscription = z.infer<typeof insertPatientSubscriptionSchema>;
export type PatientSubscription = typeof patientSubscriptionsTable.$inferSelect;
