import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { proceduresTable } from "./procedures";
import { usersTable } from "./users";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  procedureId: integer("procedure_id").notNull().references(() => proceduresTable.id),
  professionalId: integer("professional_id").references(() => usersTable.id),
  date: date("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  status: text("status").notNull().default("agendado"),
  notes: text("notes"),
  clinicId: integer("clinic_id"),
  scheduleId: integer("schedule_id"),
  recurrenceGroupId: text("recurrence_group_id"),
  recurrenceIndex: integer("recurrence_index"),
  bookingToken: text("booking_token"),
  source: text("source").notNull().default("presencial"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true, createdAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
