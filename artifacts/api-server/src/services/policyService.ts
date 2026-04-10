/**
 * policyService — Políticas de agendamento por clínica
 *
 * Executa três regras por clínica:
 * 1. Auto-confirmação: agendamentos com status "agendado" que estão dentro
 *    da janela `autoConfirmHours` horas antes do horário marcado são
 *    automaticamente confirmados (confirmedBy = "sistema").
 * 2. No-show: agendamentos "agendado" ou "confirmado" cujo horário já passou
 *    são marcados como "faltou".
 * 3. Taxa de no-show: se `noShowFeeEnabled`, gera um lançamento financeiro
 *    de taxa de ausência para agendamentos marcados como "faltou" pelo policy.
 */

import { db } from "@workspace/db";
import {
  appointmentsTable,
  clinicsTable,
  patientsTable,
  proceduresTable,
  financialRecordsTable,
} from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";

export interface PolicyRunResult {
  autoConfirmed: number;
  noShowMarked: number;
  noShowFeesGenerated: number;
  errors: number;
  details: Array<{ clinicId: number; action: string; appointmentId?: number; error?: string }>;
}

export async function runAppointmentPolicies(): Promise<PolicyRunResult> {
  const result: PolicyRunResult = {
    autoConfirmed: 0,
    noShowMarked: 0,
    noShowFeesGenerated: 0,
    errors: 0,
    details: [],
  };

  const clinics = await db
    .select()
    .from(clinicsTable)
    .where(eq(clinicsTable.isActive, true));

  for (const clinic of clinics) {
    try {
      // ── 1. AUTO-CONFIRM ──────────────────────────────────────────────────
      if (clinic.autoConfirmHours && clinic.autoConfirmHours > 0) {
        const toAutoConfirm = await db
          .select({ id: appointmentsTable.id })
          .from(appointmentsTable)
          .where(
            and(
              eq(appointmentsTable.clinicId, clinic.id),
              eq(appointmentsTable.status, "agendado"),
              sql`(
                (${appointmentsTable.date}::text || ' ' || ${appointmentsTable.startTime})::timestamp
                BETWEEN (NOW() AT TIME ZONE 'America/Sao_Paulo')
                AND ((NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '${sql.raw(String(clinic.autoConfirmHours))} hours')
              )`
            )
          );

        for (const appt of toAutoConfirm) {
          try {
            await db
              .update(appointmentsTable)
              .set({
                status: "confirmado",
                confirmedBy: "sistema",
                confirmedAt: new Date(),
              })
              .where(eq(appointmentsTable.id, appt.id));
            result.autoConfirmed++;
            result.details.push({ clinicId: clinic.id, action: "auto_confirmed", appointmentId: appt.id });
          } catch (err: any) {
            result.errors++;
            result.details.push({ clinicId: clinic.id, action: "error", appointmentId: appt.id, error: String(err.message) });
          }
        }
      }

      // ── 2. NO-SHOW DETECTION ─────────────────────────────────────────────
      const noShowCandidates = await db
        .select({
          id: appointmentsTable.id,
          patientId: appointmentsTable.patientId,
          procedureId: appointmentsTable.procedureId,
          date: appointmentsTable.date,
          endTime: appointmentsTable.endTime,
        })
        .from(appointmentsTable)
        .where(
          and(
            eq(appointmentsTable.clinicId, clinic.id),
            inArray(appointmentsTable.status, ["agendado", "confirmado"]),
            sql`(
              (${appointmentsTable.date}::text || ' ' || ${appointmentsTable.endTime})::timestamp
              < NOW() AT TIME ZONE 'America/Sao_Paulo'
            )`
          )
        );

      for (const appt of noShowCandidates) {
        try {
          await db
            .update(appointmentsTable)
            .set({ status: "faltou" })
            .where(eq(appointmentsTable.id, appt.id));
          result.noShowMarked++;
          result.details.push({ clinicId: clinic.id, action: "no_show_marked", appointmentId: appt.id });

          // ── 3. NO-SHOW FEE ───────────────────────────────────────────────
          if (clinic.noShowFeeEnabled && clinic.noShowFeeAmount) {
            const existing = await db
              .select({ id: financialRecordsTable.id })
              .from(financialRecordsTable)
              .where(
                and(
                  eq(financialRecordsTable.appointmentId, appt.id),
                  eq(financialRecordsTable.transactionType, "taxaNoShow")
                )
              )
              .limit(1);

            if (existing.length === 0) {
              const [patient] = await db
                .select({ name: patientsTable.name })
                .from(patientsTable)
                .where(eq(patientsTable.id, appt.patientId))
                .limit(1);
              const [procedure] = await db
                .select({ name: proceduresTable.name, category: proceduresTable.category })
                .from(proceduresTable)
                .where(eq(proceduresTable.id, appt.procedureId))
                .limit(1);

              await db.insert(financialRecordsTable).values({
                type: "receita",
                amount: clinic.noShowFeeAmount,
                description: `Taxa de não comparecimento — ${procedure?.name ?? "Procedimento"} · ${patient?.name ?? "Paciente"}`,
                category: procedure?.category ?? "Outros",
                appointmentId: appt.id,
                patientId: appt.patientId,
                procedureId: appt.procedureId,
                transactionType: "taxaNoShow",
                status: "pendente",
                dueDate: appt.date,
                clinicId: clinic.id,
              });
              result.noShowFeesGenerated++;
              result.details.push({ clinicId: clinic.id, action: "no_show_fee_generated", appointmentId: appt.id });
            }
          }
        } catch (err: any) {
          result.errors++;
          result.details.push({ clinicId: clinic.id, action: "error", appointmentId: appt.id, error: String(err.message) });
        }
      }
    } catch (err: any) {
      result.errors++;
      result.details.push({ clinicId: clinic.id, action: "clinic_error", error: String(err.message) });
    }
  }

  return result;
}
