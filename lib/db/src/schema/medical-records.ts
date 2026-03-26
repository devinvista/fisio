import { pgTable, serial, integer, text, timestamp, date, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { appointmentsTable } from "./appointments";

export const anamnesisTable = pgTable("anamnesis", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().unique().references(() => patientsTable.id),
  mainComplaint: text("main_complaint"),
  diseaseHistory: text("disease_history"),
  medicalHistory: text("medical_history"),
  medications: text("medications"),
  allergies: text("allergies"),
  familyHistory: text("family_history"),
  lifestyle: text("lifestyle"),
  painScale: integer("pain_scale"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAnamnesisSchema = createInsertSchema(anamnesisTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAnamnesis = z.infer<typeof insertAnamnesisSchema>;
export type Anamnesis = typeof anamnesisTable.$inferSelect;

export const evaluationsTable = pgTable("evaluations", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  inspection: text("inspection"),
  posture: text("posture"),
  rangeOfMotion: text("range_of_motion"),
  muscleStrength: text("muscle_strength"),
  orthopedicTests: text("orthopedic_tests"),
  functionalDiagnosis: text("functional_diagnosis"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEvaluationSchema = createInsertSchema(evaluationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type Evaluation = typeof evaluationsTable.$inferSelect;

export const treatmentPlansTable = pgTable("treatment_plans", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().unique().references(() => patientsTable.id),
  objectives: text("objectives"),
  techniques: text("techniques"),
  frequency: text("frequency"),
  estimatedSessions: integer("estimated_sessions"),
  startDate: date("start_date"),
  responsibleProfessional: text("responsible_professional"),
  status: text("status").notNull().default("ativo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTreatmentPlanSchema = createInsertSchema(treatmentPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTreatmentPlan = z.infer<typeof insertTreatmentPlanSchema>;
export type TreatmentPlan = typeof treatmentPlansTable.$inferSelect;

export const treatmentPlanProceduresTable = pgTable("treatment_plan_procedures", {
  id: serial("id").primaryKey(),
  treatmentPlanId: integer("treatment_plan_id").notNull().references(() => treatmentPlansTable.id, { onDelete: "cascade" }),
  procedureId: integer("procedure_id"),
  packageId: integer("package_id"),
  sessionsPerWeek: integer("sessions_per_week").notNull().default(1),
  totalSessions: integer("total_sessions"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }),
  unitMonthlyPrice: numeric("unit_monthly_price", { precision: 10, scale: 2 }),
  discount: numeric("discount", { precision: 10, scale: 2 }).default("0"),
  priority: integer("priority").notNull().default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTreatmentPlanProcedureSchema = createInsertSchema(treatmentPlanProceduresTable).omit({ id: true, createdAt: true });
export type InsertTreatmentPlanProcedure = z.infer<typeof insertTreatmentPlanProcedureSchema>;
export type TreatmentPlanProcedure = typeof treatmentPlanProceduresTable.$inferSelect;

export const evolutionsTable = pgTable("evolutions", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  appointmentId: integer("appointment_id").references(() => appointmentsTable.id),
  description: text("description"),
  patientResponse: text("patient_response"),
  clinicalNotes: text("clinical_notes"),
  complications: text("complications"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEvolutionSchema = createInsertSchema(evolutionsTable).omit({ id: true, createdAt: true });
export type InsertEvolution = z.infer<typeof insertEvolutionSchema>;
export type Evolution = typeof evolutionsTable.$inferSelect;

export const dischargeSummariesTable = pgTable("discharge_summaries", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().unique().references(() => patientsTable.id),
  dischargeDate: date("discharge_date").notNull(),
  dischargeReason: text("discharge_reason").notNull(),
  achievedResults: text("achieved_results"),
  recommendations: text("recommendations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDischargeSummarySchema = createInsertSchema(dischargeSummariesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDischargeSummary = z.infer<typeof insertDischargeSummarySchema>;
export type DischargeSummary = typeof dischargeSummariesTable.$inferSelect;

export const examAttachmentsTable = pgTable("exam_attachments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  examTitle: text("exam_title"),
  originalFilename: text("original_filename"),
  contentType: text("content_type"),
  fileSize: integer("file_size"),
  objectPath: text("object_path"),
  description: text("description"),
  resultText: text("result_text"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const insertExamAttachmentSchema = createInsertSchema(examAttachmentsTable).omit({ id: true, uploadedAt: true });
export type InsertExamAttachment = z.infer<typeof insertExamAttachmentSchema>;
export type ExamAttachment = typeof examAttachmentsTable.$inferSelect;

export const atestadosTable = pgTable("atestados", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  professionalName: text("professional_name").notNull(),
  professionalSpecialty: text("professional_specialty"),
  professionalCouncil: text("professional_council"),
  content: text("content").notNull(),
  cid: text("cid"),
  daysOff: integer("days_off"),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
});

export type Atestado = typeof atestadosTable.$inferSelect;
