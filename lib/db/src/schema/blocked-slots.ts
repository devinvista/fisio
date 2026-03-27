import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const blockedSlotsTable = pgTable("blocked_slots", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  reason: text("reason"),
  recurrenceGroupId: text("recurrence_group_id"),
  userId: integer("user_id").references(() => usersTable.id),
  clinicId: integer("clinic_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BlockedSlot = typeof blockedSlotsTable.$inferSelect;
