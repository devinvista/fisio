import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clinicsTable = pgTable("clinics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").default("clinica"),
  cnpj: text("cnpj"),
  cpf: text("cpf"),
  crefito: text("crefito"),
  responsibleTechnical: text("responsible_technical"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  website: text("website"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClinicSchema = createInsertSchema(clinicsTable).omit({ id: true, createdAt: true });
export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type Clinic = typeof clinicsTable.$inferSelect;
