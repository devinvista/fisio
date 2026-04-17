import { Router } from "express";
import { db } from "@workspace/db";
import { appointmentsTable, patientsTable, proceduresTable, procedureCostsTable, financialRecordsTable, blockedSlotsTable, patientSubscriptionsTable, sessionCreditsTable, schedulesTable, clinicsTable, patientWalletTable, patientWalletTransactionsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, ne, gt } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { resolvePermissions } from "@workspace/db";
import type { Role } from "@workspace/db";
import { todayBRT } from "../lib/dateUtils.js";
import { parseIntParam, validateBody } from "../lib/validate.js";
import { logAudit } from "../lib/auditLog.js";
import { z } from "zod/v4";

const appointmentStatusEnum = z.enum(["agendado", "confirmado", "compareceu", "concluido", "cancelado", "faltou", "remarcado"]);

// ─── State machine: valid transitions ────────────────────────────────────────
// "admin_override" keys allow any-to-any via the edit form (secretary/admin only)
const VALID_TRANSITIONS: Record<string, string[]> = {
  agendado:   ["confirmado", "compareceu", "cancelado", "faltou", "remarcado"],
  confirmado: ["compareceu", "cancelado", "faltou", "remarcado", "agendado"],
  compareceu: ["concluido", "faltou", "cancelado"],
  concluido:  [],
  cancelado:  ["agendado"],
  faltou:     ["agendado", "remarcado"],
  remarcado:  [],
};

function isValidTransition(from: string, to: string, isAdmin: boolean): boolean {
  if (from === to) return true;
  if (isAdmin && ["concluido", "remarcado"].includes(from)) return true;
  const allowed = VALID_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

// ─── Reschedule schema ────────────────────────────────────────────────────────
const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date deve estar no formato YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime deve estar no formato HH:MM"),
  notes: z.string().max(2000).optional().nullable(),
});

const createAppointmentSchema = z.object({
  patientId: z.number({ error: "patientId deve ser um número" }).int().positive(),
  procedureId: z.number({ error: "procedureId deve ser um número" }).int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date deve estar no formato YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime deve estar no formato HH:MM"),
  scheduleId: z.number().int().positive().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  professionalId: z.number().int().positive().optional().nullable(),
});

const updateAppointmentSchema = z.object({
  patientId: z.number().int().positive().optional(),
  procedureId: z.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date deve estar no formato YYYY-MM-DD").optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime deve estar no formato HH:MM").optional(),
  status: appointmentStatusEnum.optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const recurringAppointmentSchema = createAppointmentSchema.extend({
  recurrence: z.object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, "Informe ao menos um dia da semana"),
    totalSessions: z.number().int().min(1, "totalSessions deve ser no mínimo 1"),
  }),
});

const router = Router();
router.use(authMiddleware);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getWithDetails(id: number, clinicId?: number | null) {
  const conditions: any[] = [eq(appointmentsTable.id, id)];
  if (clinicId) conditions.push(eq(appointmentsTable.clinicId, clinicId));

  const result = await db
    .select({ appointment: appointmentsTable, patient: patientsTable, procedure: proceduresTable })
    .from(appointmentsTable)
    .leftJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
    .where(and(...conditions))
    .limit(1);

  if (!result[0]) return null;
  const { appointment, patient, procedure } = result[0];
  return { ...appointment, patient, procedure };
}

// ─── Billing rules ────────────────────────────────────────────────────────────

async function applyBillingRules(
  appointmentId: number,
  newStatus: string,
  oldStatus: string,
  clinicId?: number | null
): Promise<void> {
  if (newStatus === oldStatus) return;

  const details = await getWithDetails(appointmentId);
  if (!details || !details.procedure) return;

  const procedure = details.procedure;
  const billingType: string = procedure.billingType ?? "porSessao";
  const patientId = details.patientId;
  const procedureId = details.procedureId;
  const patientName = details.patient?.name ?? "Paciente";
  const today = todayBRT();
  const appointmentDate: string = (details as any).date ?? today;
  const dueDatePorSessao = addDaysToDate(appointmentDate, 3);

  const confirmedStatuses = ["compareceu", "concluido"];
  const canceledStatuses = ["cancelado"];

  const resolvedClinicId = clinicId ?? details.clinicId ?? null;

  // Resolve effective price: clinic override takes precedence over base procedure price
  let effectivePrice = String(procedure.price);
  if (resolvedClinicId && procedureId) {
    const [clinicCostRow] = await db
      .select({ priceOverride: procedureCostsTable.priceOverride })
      .from(procedureCostsTable)
      .where(
        and(
          eq(procedureCostsTable.procedureId, procedureId),
          eq(procedureCostsTable.clinicId, resolvedClinicId)
        )
      )
      .limit(1);
    if (clinicCostRow?.priceOverride) {
      effectivePrice = String(clinicCostRow.priceOverride);
    }
  }

  // ── BILLING: attendance → billing logic by type ────────────────────────────
  if (confirmedStatuses.includes(newStatus) && !confirmedStatuses.includes(oldStatus)) {

    // ── Priority 1: fatura consolidada subscription ────────────────────────
    const consolidatedConditions: any[] = [
      eq(patientSubscriptionsTable.patientId, patientId),
      eq(patientSubscriptionsTable.procedureId, procedureId),
      eq(patientSubscriptionsTable.status, "ativa"),
      eq(patientSubscriptionsTable.subscriptionType, "faturaConsolidada"),
    ];
    if (resolvedClinicId) {
      consolidatedConditions.push(eq(patientSubscriptionsTable.clinicId, resolvedClinicId));
    }

    const [consolidatedSub] = await db
      .select()
      .from(patientSubscriptionsTable)
      .where(and(...consolidatedConditions))
      .limit(1);

    if (consolidatedSub) {
      // Não cobra agora — acumula para a fatura mensal consolidada
      const existingPendente = await db
        .select({ id: financialRecordsTable.id })
        .from(financialRecordsTable)
        .where(
          and(
            eq(financialRecordsTable.appointmentId, appointmentId),
            eq(financialRecordsTable.transactionType, "pendenteFatura")
          )
        )
        .limit(1);

      if (existingPendente.length === 0) {
        await db.insert(financialRecordsTable).values({
          type:            "receita",
          amount:          effectivePrice,
          description:     `[Aguardando fatura] ${procedure.name} - ${patientName}`,
          category:        procedure.category,
          appointmentId,
          patientId,
          procedureId,
          transactionType: "pendenteFatura",
          status:          "pendente",
          dueDate:         appointmentDate,
          subscriptionId:  consolidatedSub.id,
          clinicId:        resolvedClinicId,
        });
      }
      return;
    }

    // ── Priority 2: por sessão (crédito de sessão → carteira → a receber) ──
    if (billingType === "porSessao") {
      await db.transaction(async (tx) => {
        // 2a. Verifica créditos de sessão
        const availableCredit = await tx
          .select()
          .from(sessionCreditsTable)
          .where(
            and(
              eq(sessionCreditsTable.patientId, patientId),
              eq(sessionCreditsTable.procedureId, procedureId),
              gt(sql`${sessionCreditsTable.quantity} - ${sessionCreditsTable.usedQuantity}`, 0)
            )
          )
          .limit(1);

        if (availableCredit.length > 0) {
          const credit = availableCredit[0];
          await tx
            .update(sessionCreditsTable)
            .set({ usedQuantity: credit.usedQuantity + 1 })
            .where(eq(sessionCreditsTable.id, credit.id));

          await tx.insert(financialRecordsTable).values({
            type:            "receita",
            amount:          "0",
            description:     `Uso de crédito — ${procedure.name} - ${patientName}`,
            category:        procedure.category,
            appointmentId,
            patientId,
            procedureId,
            transactionType: "usoCredito",
            status:          "pago",
            dueDate:         today,
            clinicId:        resolvedClinicId,
          });
          return;
        }

        // 2b. Verifica carteira de crédito (R$)
        if (resolvedClinicId) {
          const [wallet] = await tx
            .select()
            .from(patientWalletTable)
            .where(
              and(
                eq(patientWalletTable.patientId, patientId),
                eq(patientWalletTable.clinicId, resolvedClinicId)
              )
            )
            .limit(1);

          if (wallet && Number(wallet.balance) >= Number(effectivePrice)) {
            const newBalance = (Number(wallet.balance) - Number(effectivePrice)).toFixed(2);

            await tx
              .update(patientWalletTable)
              .set({ balance: newBalance, updatedAt: new Date() })
              .where(eq(patientWalletTable.id, wallet.id));

            const [fr] = await tx.insert(financialRecordsTable).values({
              type:            "receita",
              amount:          effectivePrice,
              description:     `Débito carteira — ${procedure.name} - ${patientName}`,
              category:        procedure.category,
              appointmentId,
              patientId,
              procedureId,
              transactionType: "usoCarteira",
              status:          "pago",
              dueDate:         today,
              clinicId:        resolvedClinicId,
            }).returning();

            await tx.insert(patientWalletTransactionsTable).values({
              walletId:          wallet.id,
              patientId,
              clinicId:          resolvedClinicId,
              amount:            `-${effectivePrice}`,
              type:              "debito",
              description:       `Sessão: ${procedure.name} — consulta #${appointmentId}`,
              appointmentId,
              financialRecordId: fr.id,
            });
            return;
          }
        }

        // 2c. Gera lançamento a receber com vencimento 3 dias após a sessão
        const existing = await tx
          .select()
          .from(financialRecordsTable)
          .where(
            and(
              eq(financialRecordsTable.appointmentId, appointmentId),
              eq(financialRecordsTable.transactionType, "creditoAReceber")
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await tx.insert(financialRecordsTable).values({
            type:            "receita",
            amount:          effectivePrice,
            description:     `${procedure.name} - ${patientName}`,
            category:        procedure.category,
            appointmentId,
            patientId,
            procedureId,
            transactionType: "creditoAReceber",
            status:          "pendente",
            dueDate:         dueDatePorSessao,
            clinicId:        resolvedClinicId,
          });
        }
      });
    }
  }

  // ── ROLLBACK: compareceu/concluido → cancelado → cancela lançamentos pendentes
  if (canceledStatuses.includes(newStatus) && confirmedStatuses.includes(oldStatus)) {
    await db
      .update(financialRecordsTable)
      .set({ status: "cancelado" })
      .where(
        and(
          eq(financialRecordsTable.appointmentId, appointmentId),
          sql`${financialRecordsTable.transactionType} IN ('creditoAReceber', 'pendenteFatura')`,
          eq(financialRecordsTable.status, "pendente")
        )
      );

    // Estorna uso de carteira se aplicável
    const walletUsage = await db
      .select()
      .from(financialRecordsTable)
      .where(
        and(
          eq(financialRecordsTable.appointmentId, appointmentId),
          eq(financialRecordsTable.transactionType, "usoCarteira"),
          eq(financialRecordsTable.status, "pago")
        )
      )
      .limit(1);

    if (walletUsage.length > 0 && resolvedClinicId) {
      const fr = walletUsage[0];
      const [wallet] = await db
        .select()
        .from(patientWalletTable)
        .where(
          and(
            eq(patientWalletTable.patientId, patientId),
            eq(patientWalletTable.clinicId, resolvedClinicId)
          )
        )
        .limit(1);

      if (wallet) {
        const restoredBalance = (Number(wallet.balance) + Number(fr.amount)).toFixed(2);
        await db
          .update(patientWalletTable)
          .set({ balance: restoredBalance, updatedAt: new Date() })
          .where(eq(patientWalletTable.id, wallet.id));

        await db.insert(patientWalletTransactionsTable).values({
          walletId:          wallet.id,
          patientId,
          clinicId:          resolvedClinicId,
          amount:            String(fr.amount),
          type:              "estorno",
          description:       `Estorno de cancelamento — consulta #${appointmentId}`,
          appointmentId,
          financialRecordId: fr.id,
        });

        await db
          .update(financialRecordsTable)
          .set({ status: "estornado" })
          .where(eq(financialRecordsTable.id, fr.id));
      }
    }
  }

  // ── BILLING: cancellation on monthly plan → generate session credit ─────────
  if (canceledStatuses.includes(newStatus) && !canceledStatuses.includes(oldStatus) && !confirmedStatuses.includes(oldStatus)) {
    if (billingType === "mensal") {
      await db.transaction(async (tx) => {
        await tx
          .insert(sessionCreditsTable)
          .values({
            patientId,
            procedureId,
            quantity: 1,
            usedQuantity: 0,
            sourceAppointmentId: appointmentId,
            clinicId: resolvedClinicId,
            notes: `Crédito por cancelamento — ${procedure.name}`,
          });

        await tx.insert(financialRecordsTable).values({
          type:            "receita",
          amount:          "0",
          description:     `Crédito de sessão gerado — ${procedure.name} - ${patientName}`,
          category:        procedure.category,
          appointmentId,
          patientId,
          procedureId,
          transactionType: "creditoSessao",
          status:          "pago",
          dueDate:         today,
          clinicId:        resolvedClinicId,
        });
      });
    }
  }

  // ── ROLLBACK: faltou → agendado → cancel no-show fee if pending ───────────
  if (newStatus === "agendado" && oldStatus === "faltou") {
    await db
      .update(financialRecordsTable)
      .set({ status: "cancelado" })
      .where(
        and(
          eq(financialRecordsTable.appointmentId, appointmentId),
          eq(financialRecordsTable.transactionType, "taxaNoShow"),
          eq(financialRecordsTable.status, "pendente")
        )
      );
  }
}

// ─── Conflict check ───────────────────────────────────────────────────────────

async function checkConflict(
  date: string,
  startTime: string,
  endTime: string,
  procedureId: number,
  maxCapacity: number,
  excludeId?: number,
  scheduleId?: number | null,
  clinicId?: number | null
): Promise<{ conflict: boolean; currentCount: number; reason?: string }> {
  if (maxCapacity > 1) {
    const sameSessionConds: any[] = [
      eq(appointmentsTable.date, date),
      eq(appointmentsTable.procedureId, procedureId),
      eq(appointmentsTable.startTime, startTime),
      sql`status NOT IN ('cancelado', 'faltou', 'remarcado')`,
    ];
    if (clinicId) sameSessionConds.push(eq(appointmentsTable.clinicId, clinicId));
    if (scheduleId) sameSessionConds.push(eq(appointmentsTable.scheduleId, scheduleId));
    if (excludeId) sameSessionConds.push(ne(appointmentsTable.id, excludeId));

    const sameSession = await db
      .select({ id: appointmentsTable.id })
      .from(appointmentsTable)
      .where(and(...sameSessionConds));

    if (sameSession.length >= maxCapacity) {
      return { conflict: true, currentCount: sameSession.length, reason: "full" };
    }

    const overlapConds: any[] = [
      eq(appointmentsTable.date, date),
      eq(appointmentsTable.procedureId, procedureId),
      sql`status NOT IN ('cancelado', 'faltou', 'remarcado')`,
      sql`start_time != ${startTime}`,
      sql`start_time < ${endTime} AND end_time > ${startTime}`,
    ];
    if (clinicId) overlapConds.push(eq(appointmentsTable.clinicId, clinicId));
    if (scheduleId) overlapConds.push(eq(appointmentsTable.scheduleId, scheduleId));
    if (excludeId) overlapConds.push(ne(appointmentsTable.id, excludeId));

    const overlapping = await db
      .select({ id: appointmentsTable.id, startTime: appointmentsTable.startTime })
      .from(appointmentsTable)
      .where(and(...overlapConds));

    if (overlapping.length > 0) {
      return { conflict: true, currentCount: sameSession.length, reason: "overlap" };
    }

    return { conflict: false, currentCount: sameSession.length };
  } else {
    const conditions: any[] = [
      eq(appointmentsTable.date, date),
      sql`status NOT IN ('cancelado', 'faltou', 'remarcado')`,
      sql`start_time < ${endTime} AND end_time > ${startTime}`,
    ];
    if (clinicId) conditions.push(eq(appointmentsTable.clinicId, clinicId));
    if (scheduleId) conditions.push(eq(appointmentsTable.scheduleId, scheduleId));
    if (excludeId) conditions.push(ne(appointmentsTable.id, excludeId));

    const existing = await db
      .select({ id: appointmentsTable.id })
      .from(appointmentsTable)
      .where(and(...conditions));

    return { conflict: existing.length > 0, currentCount: existing.length };
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/", requirePermission("appointments.read"), async (req: AuthRequest, res) => {
  try {
    const { date, startDate, endDate, patientId, status } = req.query;

    let query = db
      .select({ appointment: appointmentsTable, patient: patientsTable, procedure: proceduresTable })
      .from(appointmentsTable)
      .leftJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id));

    const conditions = [];

    if (!req.isSuperAdmin && req.clinicId) {
      conditions.push(eq(appointmentsTable.clinicId, req.clinicId));
    }

    const roles = (req.userRoles ?? []) as Role[];
    const perms = resolvePermissions(roles, req.isSuperAdmin);
    const isAdminOrSecretary = perms.has("users.manage") || roles.includes("secretaria");
    if (!isAdminOrSecretary && roles.includes("profissional") && req.userId) {
      conditions.push(eq(appointmentsTable.professionalId, req.userId));
    }

    if (date) conditions.push(eq(appointmentsTable.date, date as string));
    if (startDate) conditions.push(gte(appointmentsTable.date, startDate as string));
    if (endDate) conditions.push(lte(appointmentsTable.date, endDate as string));
    if (patientId) conditions.push(eq(appointmentsTable.patientId, parseInt(patientId as string)));
    if (status) conditions.push(eq(appointmentsTable.status, status as string));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(appointmentsTable.date, appointmentsTable.startTime);
    const appointments = results.map(({ appointment, patient, procedure }) => ({
      ...appointment,
      patient,
      procedure,
    }));

    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/available-slots", requirePermission("appointments.read"), async (req, res) => {
  try {
    const { date, procedureId, scheduleId } = req.query;
    let { clinicStart = "08:00", clinicEnd = "18:00" } = req.query;
    let slotStep = 30;

    if (!date || !procedureId) {
      res.status(400).json({ error: "date e procedureId são obrigatórios" });
      return;
    }

    let resolvedScheduleId: number | null = null;
    if (scheduleId) {
      resolvedScheduleId = parseInt(scheduleId as string);
      const [schedule] = await db
        .select()
        .from(schedulesTable)
        .where(eq(schedulesTable.id, resolvedScheduleId));
      if (schedule) {
        clinicStart = schedule.startTime;
        clinicEnd = schedule.endTime;
        slotStep = schedule.slotDurationMinutes ?? 30;

        if (schedule.workingDays) {
          const workingDayNums = schedule.workingDays.split(",").map(Number);
          const dateDow = new Date((date as string) + "T12:00:00Z").getUTCDay();
          if (!workingDayNums.includes(dateDow)) {
            res.json({
              date,
              procedure: { id: 0, name: "", durationMinutes: 0, maxCapacity: 1 },
              slots: [],
              notWorkingDay: true,
            });
            return;
          }
        }
      }
    }

    const [procedure] = await db
      .select()
      .from(proceduresTable)
      .where(eq(proceduresTable.id, parseInt(procedureId as string)));

    if (!procedure) {
      res.status(404).json({ error: "Procedimento não encontrado" });
      return;
    }

    const openMin = timeToMinutes(clinicStart as string);
    const closeMin = timeToMinutes(clinicEnd as string);
    const duration = procedure.durationMinutes;
    const maxCap = procedure.maxCapacity ?? 1;

    const apptConditions: any[] = [
      eq(appointmentsTable.date, date as string),
      sql`status NOT IN ('cancelado', 'faltou', 'remarcado')`,
    ];
    if (resolvedScheduleId) {
      apptConditions.push(eq(appointmentsTable.scheduleId, resolvedScheduleId));
    }

    const existingAppts = await db
      .select({
        id: appointmentsTable.id,
        procedureId: appointmentsTable.procedureId,
        startTime: appointmentsTable.startTime,
        endTime: appointmentsTable.endTime,
      })
      .from(appointmentsTable)
      .where(and(...apptConditions));

    const blockedConditions: any[] = [eq(blockedSlotsTable.date, date as string)];
    const authReq = req as AuthRequest;
    if (!authReq.isSuperAdmin && authReq.clinicId) {
      blockedConditions.push(eq(blockedSlotsTable.clinicId, authReq.clinicId));
    }
    if (resolvedScheduleId) {
      blockedConditions.push(eq(blockedSlotsTable.scheduleId, resolvedScheduleId));
    }

    const blockedSlots = await db
      .select({ startTime: blockedSlotsTable.startTime, endTime: blockedSlotsTable.endTime })
      .from(blockedSlotsTable)
      .where(and(...blockedConditions));

    const slots: { time: string; available: boolean; spotsLeft: number }[] = [];
    const effectiveStep = Math.min(slotStep, duration > 0 ? duration : slotStep);

    for (let start = openMin; start + duration <= closeMin; start += effectiveStep) {
      const startTime = minutesToTime(start);
      const slotEnd = start + duration;

      const isBlocked = blockedSlots.some(
        (b) => timeToMinutes(b.startTime) < slotEnd && timeToMinutes(b.endTime) > start
      );

      if (isBlocked) {
        slots.push({ time: startTime, available: false, spotsLeft: 0 });
        continue;
      }

      let spotsLeft: number;

      if (maxCap > 1) {
        const sameSessionCount = existingAppts.filter(
          (a) => a.procedureId === procedure.id && a.startTime === startTime
        ).length;

        const hasConflictingSession = existingAppts.some(
          (a) =>
            a.procedureId === procedure.id &&
            a.startTime !== startTime &&
            timeToMinutes(a.startTime) < slotEnd &&
            timeToMinutes(a.endTime) > start
        );

        spotsLeft = hasConflictingSession ? 0 : Math.max(0, maxCap - sameSessionCount);
      } else {
        const occupiedCount = existingAppts.filter(
          (a) =>
            timeToMinutes(a.startTime) < slotEnd &&
            timeToMinutes(a.endTime) > start
        ).length;
        spotsLeft = Math.max(0, maxCap - occupiedCount);
      }

      slots.push({ time: startTime, available: spotsLeft > 0, spotsLeft });
    }

    res.json({
      date,
      procedure: {
        id: procedure.id,
        name: procedure.name,
        durationMinutes: procedure.durationMinutes,
        maxCapacity: maxCap,
      },
      slots,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requirePermission("appointments.create"), async (req: AuthRequest, res) => {
  try {
    const body = validateBody(createAppointmentSchema, req.body, res);
    if (!body) return;
    const { patientId, procedureId, date, startTime, notes, scheduleId } = body;

    const [procedure] = await db
      .select()
      .from(proceduresTable)
      .where(eq(proceduresTable.id, procedureId));

    if (!procedure) {
      res.status(404).json({ error: "Not Found", message: "Procedimento não encontrado" });
      return;
    }

    const endTime = addMinutes(startTime, procedure.durationMinutes);
    const maxCapacity = procedure.maxCapacity ?? 1;
    const resolvedScheduleId = scheduleId ? parseInt(String(scheduleId)) : null;

    // Validate that the appointment fits within schedule working hours
    if (resolvedScheduleId) {
      const [schedule] = await db
        .select({ startTime: schedulesTable.startTime, endTime: schedulesTable.endTime })
        .from(schedulesTable)
        .where(eq(schedulesTable.id, resolvedScheduleId));
      if (schedule) {
        if (
          timeToMinutes(startTime) < timeToMinutes(schedule.startTime) ||
          timeToMinutes(endTime) > timeToMinutes(schedule.endTime)
        ) {
          res.status(422).json({
            error: "OutOfHours",
            message: `O procedimento extrapola o horário de atendimento da agenda (${schedule.startTime}–${schedule.endTime}). Escolha um horário em que o procedimento termine até às ${schedule.endTime}.`,
          });
          return;
        }
      }
    }

    const { conflict, currentCount, reason } = await checkConflict(
      date, startTime, endTime, procedure.id, maxCapacity, undefined, resolvedScheduleId, req.clinicId
    );

    if (conflict) {
      let message: string;
      if (maxCapacity > 1) {
        message = reason === "full"
          ? `Horário lotado: ${currentCount}/${maxCapacity} vagas ocupadas para "${procedure.name}" neste horário.`
          : `Conflito de horário: já existe uma sessão de "${procedure.name}" que se sobrepõe a este horário.`;
      } else {
        message = `Conflito de horário: já existe um agendamento entre ${startTime} e ${endTime}.`;
      }
      res.status(409).json({ error: "Conflict", message });
      return;
    }

    const roles2 = (req.userRoles ?? []) as Role[];
    const perms2 = resolvePermissions(roles2, req.isSuperAdmin);
    const isAdminOrSecretary2 = perms2.has("users.manage") || roles2.includes("secretaria");
    const resolvedProfessionalId = isAdminOrSecretary2
      ? (body.professionalId ?? req.userId)
      : req.userId;

    const [appointment] = await db
      .insert(appointmentsTable)
      .values({
        patientId,
        procedureId,
        date,
        startTime,
        endTime,
        status: "agendado",
        notes,
        professionalId: resolvedProfessionalId,
        clinicId: req.clinicId ?? null,
        scheduleId: resolvedScheduleId,
      })
      .returning();

    const createActor = (req as AuthRequest).userName ?? `usuário #${req.userId}`;
    await logAudit({
      userId: req.userId,
      userName: (req as AuthRequest).userName,
      patientId,
      action: "create",
      entityType: "appointment",
      entityId: appointment.id,
      summary: `Agendamento criado: ${procedure.name} em ${date} às ${startTime} (por ${createActor})`,
    });

    const details = await getWithDetails(appointment.id);
    res.status(201).json(details);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", requirePermission("appointments.read"), async (req, res) => {
  try {
    const id = parseIntParam(req.params.id, res, "ID do agendamento");
    if (id === null) return;
    const details = await getWithDetails(id, (req as AuthRequest).clinicId);
    if (!details) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    res.json(details);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", requirePermission("appointments.update"), async (req, res) => {
  try {
    const id = parseIntParam(req.params.id, res, "ID do agendamento");
    if (id === null) return;
    const body = validateBody(updateAppointmentSchema, req.body, res);
    if (!body) return;
    const { patientId, procedureId, date, startTime, status, notes } = body;

    const currentAppt = await getWithDetails(id);
    if (!currentAppt) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    const oldStatus = currentAppt.status;

    // ── State machine validation ───────────────────────────────────────────
    if (status && status !== oldStatus) {
      const authReqSM = req as AuthRequest;
      const rolesSM = (authReqSM.userRoles ?? []) as Role[];
      const permsSM = resolvePermissions(rolesSM, authReqSM.isSuperAdmin);
      const isAdminSM = authReqSM.isSuperAdmin || permsSM.has("users.manage") || rolesSM.includes("secretaria");

      if (!isValidTransition(oldStatus, status, isAdminSM)) {
        res.status(422).json({
          error: "InvalidTransition",
          message: `Não é possível alterar de "${oldStatus}" para "${status}".`,
        });
        return;
      }
    }

    // ── Cancellation policy enforcement ───────────────────────────────────
    if (status === "cancelado" && oldStatus !== "cancelado") {
      const authReqCP = req as AuthRequest;
      const rolesCP = (authReqCP.userRoles ?? []) as Role[];
      const permsCP = resolvePermissions(rolesCP, authReqCP.isSuperAdmin);
      const isAdminCP = authReqCP.isSuperAdmin || permsCP.has("users.manage") || rolesCP.includes("secretaria");

      if (!isAdminCP && authReqCP.clinicId) {
        const [clinic] = await db
          .select({ cancellationPolicyHours: clinicsTable.cancellationPolicyHours })
          .from(clinicsTable)
          .where(eq(clinicsTable.id, authReqCP.clinicId))
          .limit(1);

        if (clinic?.cancellationPolicyHours && clinic.cancellationPolicyHours > 0) {
          const apptDate = currentAppt.date;
          const apptStart = currentAppt.startTime;
          const apptDatetime = new Date(`${apptDate}T${apptStart}:00`);
          const nowBRT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
          const diffHours = (apptDatetime.getTime() - nowBRT.getTime()) / (1000 * 60 * 60);

          if (diffHours < clinic.cancellationPolicyHours && diffHours > 0) {
            res.status(422).json({
              error: "CancellationPolicyViolation",
              message: `Cancelamento não permitido: a política da clínica exige aviso com ${clinic.cancellationPolicyHours}h de antecedência. Contate a secretaria.`,
            });
            return;
          }
        }
      }
    }

    let endTime: string | undefined;
    let maxCapacity = 1;
    let effectiveProcedureId = procedureId;
    let effectiveScheduleId: number | null = null;

    // ── Recalculate endTime whenever startTime OR procedureId changes ──────
    const needsEndTimeRecalc = !!(startTime || procedureId);
    if (needsEndTimeRecalc) {
      const targetProcedureId = procedureId ?? currentAppt.procedureId;
      const targetStartTime = startTime ?? currentAppt.startTime;

      const [proc] = await db
        .select()
        .from(proceduresTable)
        .where(eq(proceduresTable.id, targetProcedureId));

      if (proc) {
        endTime = addMinutes(targetStartTime, proc.durationMinutes);
        maxCapacity = proc.maxCapacity ?? 1;
        effectiveProcedureId = targetProcedureId;
        effectiveScheduleId = currentAppt.scheduleId ?? null;
      }
    }

    // ── Conflict check if scheduling fields changed ────────────────────────
    const targetDate = date ?? currentAppt.date;
    const targetStart = startTime ?? currentAppt.startTime;
    if (endTime && effectiveProcedureId != null) {
      const authReqFC = req as AuthRequest;
      const { conflict, currentCount, reason } = await checkConflict(
        targetDate, targetStart, endTime, effectiveProcedureId, maxCapacity, id, effectiveScheduleId, authReqFC.clinicId
      );

      if (conflict) {
        const calculatedEnd = endTime;
        let message: string;
        if (maxCapacity > 1) {
          message = reason === "full"
            ? `Horário lotado: ${currentCount}/${maxCapacity} vagas ocupadas neste horário.`
            : `Conflito de horário: já existe uma sessão que se sobrepõe a este horário.`;
        } else {
          message = `Conflito de horário: já existe um agendamento entre ${targetStart} e ${calculatedEnd}.`;
        }
        res.status(409).json({ error: "Conflict", message });
        return;
      }
    }

    const updateFields: Record<string, any> = {};
    if (patientId !== undefined) updateFields.patientId = patientId;
    if (procedureId !== undefined) updateFields.procedureId = procedureId;
    if (date !== undefined) updateFields.date = date;
    if (startTime !== undefined) updateFields.startTime = startTime;
    if (endTime !== undefined) updateFields.endTime = endTime;
    if (status !== undefined) updateFields.status = status;
    if (notes !== undefined) updateFields.notes = notes;

    // Set confirmedBy when status moves to confirmado
    if (status === "confirmado" && oldStatus !== "confirmado") {
      const authReqCB = req as AuthRequest;
      const rolesCB = (authReqCB.userRoles ?? []) as Role[];
      const permsCB = resolvePermissions(rolesCB, authReqCB.isSuperAdmin);
      const isAdminCB = authReqCB.isSuperAdmin || permsCB.has("users.manage") || rolesCB.includes("secretaria");
      updateFields.confirmedBy = isAdminCB ? "secretaria" : "paciente";
      updateFields.confirmedAt = new Date();
    }

    const authReq = req as AuthRequest;
    const updateWhere = (!authReq.isSuperAdmin && authReq.clinicId)
      ? and(eq(appointmentsTable.id, id), eq(appointmentsTable.clinicId, authReq.clinicId))
      : eq(appointmentsTable.id, id);

    const [appointment] = await db
      .update(appointmentsTable)
      .set(updateFields)
      .where(updateWhere)
      .returning();

    if (!appointment) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    // ── Billing rules ──────────────────────────────────────────────────────
    if (status && status !== oldStatus) {
      await applyBillingRules(appointment.id, status, oldStatus, authReq.clinicId);
    }

    // ── Audit log ─────────────────────────────────────────────────────────
    const auditActor = authReq.userName ?? `usuário #${authReq.userId}`;
    if (status && status !== oldStatus) {
      await logAudit({
        userId: authReq.userId,
        userName: authReq.userName,
        patientId: currentAppt.patientId,
        action: "update",
        entityType: "appointment",
        entityId: id,
        summary: `Status: ${oldStatus} → ${status} (por ${auditActor})`,
      });
    } else if (Object.keys(updateFields).length > 0) {
      await logAudit({
        userId: authReq.userId,
        userName: authReq.userName,
        patientId: currentAppt.patientId,
        action: "update",
        entityType: "appointment",
        entityId: id,
        summary: `Agendamento atualizado (por ${auditActor})`,
      });
    }

    const details = await getWithDetails(appointment.id);
    res.json(details);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", requirePermission("appointments.delete"), async (req, res) => {
  try {
    const id = parseIntParam(req.params.id, res, "ID do agendamento");
    if (id === null) return;
    const authReq = req as AuthRequest;
    const whereClause = (!authReq.isSuperAdmin && authReq.clinicId)
      ? and(eq(appointmentsTable.id, id), eq(appointmentsTable.clinicId, authReq.clinicId))
      : eq(appointmentsTable.id, id);
    const [deleted] = await db.delete(appointmentsTable).where(whereClause).returning({ id: appointmentsTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    await logAudit({
      userId: authReq.userId,
      action: "delete",
      entityType: "appointment",
      entityId: id,
      summary: `Agendamento excluído`,
    });

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Reschedule (atomic: mark old as remarcado + create new) ─────────────────
router.post("/:id/reschedule", requirePermission("appointments.create"), async (req: AuthRequest, res) => {
  try {
    const id = parseIntParam(req.params.id, res, "ID do agendamento");
    if (id === null) return;

    const body = validateBody(rescheduleSchema, req.body, res);
    if (!body) return;

    const { date, startTime, notes } = body;

    const original = await getWithDetails(id, req.clinicId);
    if (!original) {
      res.status(404).json({ error: "Not Found", message: "Agendamento não encontrado." });
      return;
    }

    const blockableStatuses = ["agendado", "confirmado", "faltou"];
    if (!blockableStatuses.includes(original.status)) {
      res.status(422).json({
        error: "InvalidOperation",
        message: `Não é possível remarcar um agendamento com status "${original.status}".`,
      });
      return;
    }

    if (!original.procedure) {
      res.status(422).json({ error: "InvalidOperation", message: "Procedimento do agendamento não encontrado." });
      return;
    }

    const endTime = addMinutes(startTime, original.procedure.durationMinutes);
    const maxCapacity = original.procedure.maxCapacity ?? 1;

    // Validate that the rescheduled appointment fits within schedule working hours
    if (original.scheduleId) {
      const [schedule] = await db
        .select({ startTime: schedulesTable.startTime, endTime: schedulesTable.endTime })
        .from(schedulesTable)
        .where(eq(schedulesTable.id, original.scheduleId));
      if (schedule) {
        if (
          timeToMinutes(startTime) < timeToMinutes(schedule.startTime) ||
          timeToMinutes(endTime) > timeToMinutes(schedule.endTime)
        ) {
          res.status(422).json({
            error: "OutOfHours",
            message: `O procedimento extrapola o horário de atendimento da agenda (${schedule.startTime}–${schedule.endTime}). Escolha um horário em que o procedimento termine até às ${schedule.endTime}.`,
          });
          return;
        }
      }
    }

    const { conflict, currentCount, reason } = await checkConflict(
      date, startTime, endTime, original.procedureId, maxCapacity,
      undefined, original.scheduleId, req.clinicId
    );

    if (conflict) {
      let message: string;
      if (maxCapacity > 1) {
        message = reason === "full"
          ? `Horário lotado: ${currentCount}/${maxCapacity} vagas ocupadas neste horário.`
          : `Conflito de horário: já existe uma sessão que se sobrepõe a este horário.`;
      } else {
        message = `Conflito de horário: já existe um agendamento entre ${startTime} e ${endTime}.`;
      }
      res.status(409).json({ error: "Conflict", message });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [newAppt] = await tx
        .insert(appointmentsTable)
        .values({
          patientId: original.patientId,
          procedureId: original.procedureId,
          professionalId: original.professionalId,
          date,
          startTime,
          endTime,
          status: "agendado",
          notes: notes ?? original.notes,
          clinicId: original.clinicId,
          scheduleId: original.scheduleId,
          source: original.source,
        })
        .returning();

      await tx
        .update(appointmentsTable)
        .set({ status: "remarcado", rescheduledToId: newAppt.id })
        .where(eq(appointmentsTable.id, id));

      return newAppt;
    });

    // Cancel any pending no-show fee from the original appointment
    await db
      .update(financialRecordsTable)
      .set({ status: "cancelado" })
      .where(
        and(
          eq(financialRecordsTable.appointmentId, id),
          eq(financialRecordsTable.transactionType, "taxaNoShow"),
          eq(financialRecordsTable.status, "pendente")
        )
      );

    const rescheduleActor = req.userName ?? `usuário #${req.userId}`;
    await logAudit({
      userId: req.userId,
      userName: req.userName,
      patientId: original.patientId,
      action: "update",
      entityType: "appointment",
      entityId: id,
      summary: `Remarcado para ${date} às ${startTime} (novo ID: ${result.id}) (por ${rescheduleActor})`,
    });

    const newDetails = await getWithDetails(result.id);
    const oldDetails = await getWithDetails(id);

    res.status(201).json({ rescheduled: oldDetails, new: newDetails });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Complete ─────────────────────────────────────────────────────────────────
router.post("/:id/complete", requirePermission("appointments.update"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const clinicId = (req as AuthRequest).clinicId;

    const details = await getWithDetails(id, clinicId);
    if (!details) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const oldStatus = details.status;
    const authReq = req as AuthRequest;
    const rolesC = (authReq.userRoles ?? []) as Role[];
    const permsC = resolvePermissions(rolesC, authReq.isSuperAdmin);
    const isAdminC = authReq.isSuperAdmin || permsC.has("users.manage") || rolesC.includes("secretaria");

    if (!isValidTransition(oldStatus, "concluido", isAdminC)) {
      res.status(422).json({
        error: "InvalidTransition",
        message: `Não é possível concluir um agendamento com status "${oldStatus}".`,
      });
      return;
    }

    const [appointment] = await db
      .update(appointmentsTable)
      .set({ status: "concluido" })
      .where(eq(appointmentsTable.id, id))
      .returning();

    await applyBillingRules(id, "concluido", oldStatus, clinicId);

    const completeActor = authReq.userName ?? `usuário #${authReq.userId}`;
    await logAudit({
      userId: authReq.userId,
      userName: authReq.userName,
      patientId: details.patientId,
      action: "update",
      entityType: "appointment",
      entityId: id,
      summary: `Status: ${oldStatus} → concluido (por ${completeActor})`,
    });

    const updatedDetails = await getWithDetails(appointment.id, clinicId);
    res.json(updatedDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Recurring ────────────────────────────────────────────────────────────────
router.post("/recurring", requirePermission("appointments.create"), async (req: AuthRequest, res) => {
  try {
    const body = validateBody(recurringAppointmentSchema, req.body, res);
    if (!body) return;
    const { patientId, procedureId, date, startTime, notes, recurrence, scheduleId } = body;
    const { daysOfWeek, totalSessions } = recurrence;

    const [procedure] = await db.select().from(proceduresTable).where(eq(proceduresTable.id, procedureId));
    if (!procedure) {
      res.status(404).json({ error: "Not Found", message: "Procedimento não encontrado" });
      return;
    }

    const resolvedScheduleId = scheduleId ? parseInt(String(scheduleId)) : null;

    const rolesR = (req.userRoles ?? []) as Role[];
    const permsR = resolvePermissions(rolesR, req.isSuperAdmin);
    const isAdminOrSecretaryR = permsR.has("users.manage") || rolesR.includes("secretaria");
    const resolvedProfessionalId = isAdminOrSecretaryR
      ? ((body as any).professionalId ?? req.userId)
      : req.userId;

    const endTimeFn = (st: string) => addMinutes(st, procedure.durationMinutes);
    const maxCapacity = procedure.maxCapacity ?? 1;
    const recurrenceGroupId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const created = [];
    const skipped = [];

    let sessionCount = 0;
    let cursor = new Date(date + "T12:00:00Z");
    let safetyLimit = 0;

    while (sessionCount < totalSessions && safetyLimit < 500) {
      safetyLimit++;
      const dow = cursor.getUTCDay();
      if (daysOfWeek.includes(dow)) {
        const sessionDate = cursor.toISOString().slice(0, 10);
        const et = endTimeFn(startTime);
        const { conflict, reason, currentCount } = await checkConflict(sessionDate, startTime, et, procedure.id, maxCapacity, undefined, resolvedScheduleId, req.clinicId);
        if (conflict) {
          skipped.push({ date: sessionDate, reason: reason || "conflict", currentCount });
        } else {
          const [apt] = await db.insert(appointmentsTable).values({
            patientId,
            procedureId,
            date: sessionDate,
            startTime,
            endTime: et,
            status: "agendado",
            notes: notes || undefined,
            professionalId: resolvedProfessionalId,
            clinicId: req.clinicId ?? null,
            scheduleId: resolvedScheduleId,
            recurrenceGroupId,
            recurrenceIndex: sessionCount,
          }).returning();
          created.push(apt);
          sessionCount++;
        }
      }
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }

    res.status(201).json({ created: created.length, skipped: skipped.length, recurrenceGroupId, skippedDetails: skipped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
