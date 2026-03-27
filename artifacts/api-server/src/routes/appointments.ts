import { Router } from "express";
import { db } from "@workspace/db";
import { appointmentsTable, patientsTable, proceduresTable, financialRecordsTable, blockedSlotsTable, patientSubscriptionsTable, sessionCreditsTable, schedulesTable } from "@workspace/db";
import { eq, and, gte, lte, sql, ne, gt } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { resolvePermissions } from "@workspace/db";
import type { Role } from "@workspace/db";

const router = Router();
router.use(authMiddleware);

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

async function getWithDetails(id: number) {
  const result = await db
    .select({ appointment: appointmentsTable, patient: patientsTable, procedure: proceduresTable })
    .from(appointmentsTable)
    .leftJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
    .where(eq(appointmentsTable.id, id))
    .limit(1);

  if (!result[0]) return null;
  const { appointment, patient, procedure } = result[0];
  return { ...appointment, patient, procedure };
}

async function applyBillingRules(
  appointmentId: number,
  newStatus: string,
  oldStatus: string
): Promise<void> {
  if (newStatus === oldStatus) return;

  const details = await getWithDetails(appointmentId);
  if (!details || !details.procedure) return;

  const procedure = details.procedure as any;
  const billingType: string = procedure.billingType ?? "porSessao";
  const patientId = details.patientId;
  const procedureId = details.procedureId;
  const patientName = details.patient?.name ?? "Paciente";
  const today = new Date().toISOString().slice(0, 10);

  const confirmedStatuses = ["confirmado", "concluido", "compareceu"];
  const canceledStatuses = ["cancelado"];

  if (confirmedStatuses.includes(newStatus) && !confirmedStatuses.includes(oldStatus)) {
    if (billingType === "porSessao") {
      const availableCredit = await db
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
        await db
          .update(sessionCreditsTable)
          .set({ usedQuantity: credit.usedQuantity + 1 })
          .where(eq(sessionCreditsTable.id, credit.id));

        await db.insert(financialRecordsTable).values({
          type: "receita",
          amount: "0",
          description: `Uso de crédito — ${procedure.name} - ${patientName}`,
          category: procedure.category,
          appointmentId,
          patientId,
          procedureId,
          transactionType: "usoCredito",
          status: "pago",
          dueDate: today,
        });
      } else {
        const existing = await db
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
          await db.insert(financialRecordsTable).values({
            type: "receita",
            amount: String(procedure.price),
            description: `${procedure.name} - ${patientName}`,
            category: procedure.category,
            appointmentId,
            patientId,
            procedureId,
            transactionType: "creditoAReceber",
            status: "pendente",
            dueDate: today,
          });
        }
      }
    }
  }

  if (canceledStatuses.includes(newStatus) && !canceledStatuses.includes(oldStatus)) {
    if (billingType === "mensal") {
      const [credit] = await db
        .insert(sessionCreditsTable)
        .values({
          patientId,
          procedureId,
          quantity: 1,
          usedQuantity: 0,
          sourceAppointmentId: appointmentId,
          notes: `Crédito por cancelamento — ${procedure.name}`,
        })
        .returning();

      await db.insert(financialRecordsTable).values({
        type: "receita",
        amount: "0",
        description: `Crédito de sessão gerado — ${procedure.name} - ${patientName}`,
        category: procedure.category,
        appointmentId,
        patientId,
        procedureId,
        transactionType: "creditoSessao",
        status: "pago",
        dueDate: today,
      });
    }
  }
}

async function checkConflict(
  date: string,
  startTime: string,
  endTime: string,
  procedureId: number,
  maxCapacity: number,
  excludeId?: number,
  scheduleId?: number | null
): Promise<{ conflict: boolean; currentCount: number; reason?: string }> {
  if (maxCapacity > 1) {
    // Rule: all patients in a group session must share the exact same startTime (and endTime).
    // 1. Count bookings already in this exact group session (scoped to the same schedule when provided).
    const sameSessionConds: any[] = [
      eq(appointmentsTable.date, date),
      eq(appointmentsTable.procedureId, procedureId),
      eq(appointmentsTable.startTime, startTime),
      sql`status NOT IN ('cancelado', 'faltou')`,
    ];
    if (scheduleId) sameSessionConds.push(eq(appointmentsTable.scheduleId, scheduleId));
    if (excludeId) sameSessionConds.push(ne(appointmentsTable.id, excludeId));

    const sameSession = await db
      .select({ id: appointmentsTable.id })
      .from(appointmentsTable)
      .where(and(...sameSessionConds));

    if (sameSession.length >= maxCapacity) {
      return { conflict: true, currentCount: sameSession.length, reason: "full" };
    }

    // 2. Ensure no other group session of this procedure overlaps this time slot within the same schedule.
    const overlapConds: any[] = [
      eq(appointmentsTable.date, date),
      eq(appointmentsTable.procedureId, procedureId),
      sql`status NOT IN ('cancelado', 'faltou')`,
      sql`start_time != ${startTime}`,
      sql`start_time < ${endTime} AND end_time > ${startTime}`,
    ];
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
    // Rule: next slot is only free after the previous one ends.
    // When a scheduleId is provided, only check conflicts within the same schedule.
    const conditions: any[] = [
      eq(appointmentsTable.date, date),
      sql`status NOT IN ('cancelado', 'faltou')`,
      sql`start_time < ${endTime} AND end_time > ${startTime}`,
    ];
    if (scheduleId) conditions.push(eq(appointmentsTable.scheduleId, scheduleId));
    if (excludeId) conditions.push(ne(appointmentsTable.id, excludeId));

    const existing = await db
      .select({ id: appointmentsTable.id })
      .from(appointmentsTable)
      .where(and(...conditions));

    return { conflict: existing.length > 0, currentCount: existing.length };
  }
}

router.get("/", requirePermission("appointments.read"), async (req: AuthRequest, res) => {
  try {
    const { date, startDate, endDate, patientId, status } = req.query;

    let query = db
      .select({ appointment: appointmentsTable, patient: patientsTable, procedure: proceduresTable })
      .from(appointmentsTable)
      .leftJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id));

    const conditions = [];

    // Clinic isolation
    if (!req.isSuperAdmin && req.clinicId) {
      conditions.push(eq(appointmentsTable.clinicId, req.clinicId));
    }

    // Profissional without admin permission sees only their own appointments
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
    let slotStep = 30; // default step in minutes

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

        // Validate that the requested date is a working day for this schedule
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

    // Fetch only appointments from the relevant schedule (or all if no schedule filter)
    const apptConditions: any[] = [
      eq(appointmentsTable.date, date as string),
      sql`status NOT IN ('cancelado', 'faltou')`,
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

    const blockedSlots = await db
      .select({ startTime: blockedSlotsTable.startTime, endTime: blockedSlotsTable.endTime })
      .from(blockedSlotsTable)
      .where(eq(blockedSlotsTable.date, date as string));

    const slots: { time: string; available: boolean; spotsLeft: number }[] = [];

    // Use the schedule's slot step so the grid aligns with the configured agenda
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
        // Group procedures: all patients share the exact same startTime.
        const sameSessionCount = existingAppts.filter(
          (a) => a.procedureId === procedure.id && a.startTime === startTime
        ).length;

        // Check if a DIFFERENT group session of this procedure overlaps this slot.
        const hasConflictingSession = existingAppts.some(
          (a) =>
            a.procedureId === procedure.id &&
            a.startTime !== startTime &&
            timeToMinutes(a.startTime) < slotEnd &&
            timeToMinutes(a.endTime) > start
        );

        if (hasConflictingSession) {
          spotsLeft = 0;
        } else {
          spotsLeft = Math.max(0, maxCap - sameSessionCount);
        }
      } else {
        // Individual procedures: blocked if any appointment overlaps this slot.
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
    const { patientId, procedureId, date, startTime, notes, scheduleId } = req.body;

    if (!patientId || !procedureId || !date || !startTime) {
      res.status(400).json({
        error: "Bad Request",
        message: "patientId, procedureId, date e startTime são obrigatórios",
      });
      return;
    }

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

    const { conflict, currentCount, reason } = await checkConflict(
      date, startTime, endTime, procedure.id, maxCapacity, undefined, resolvedScheduleId
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
        professionalId: req.userId,
        clinicId: req.clinicId ?? null,
        scheduleId: resolvedScheduleId,
      })
      .returning();

    const details = await getWithDetails(appointment.id);
    res.status(201).json(details);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", requirePermission("appointments.read"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const details = await getWithDetails(id);
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
    const id = parseInt(req.params.id as string);
    const { patientId, procedureId, date, startTime, status, notes } = req.body;

    let endTime: string | undefined;
    let maxCapacity = 1;
    let effectiveProcedureId = procedureId;
    let effectiveScheduleId: number | null = null;

    if (startTime) {
      if (procedureId) {
        const [proc] = await db
          .select()
          .from(proceduresTable)
          .where(eq(proceduresTable.id, procedureId));
        if (proc) {
          endTime = addMinutes(startTime, proc.durationMinutes);
          maxCapacity = proc.maxCapacity ?? 1;
        }
      } else {
        const current = await getWithDetails(id);
        if (current?.procedure) {
          endTime = addMinutes(startTime, current.procedure.durationMinutes);
          maxCapacity = (current.procedure as any).maxCapacity ?? 1;
          effectiveProcedureId = current.procedureId;
          effectiveScheduleId = (current as any).scheduleId ?? null;
        }
      }

      if (date && endTime) {
        const { conflict, currentCount, reason } = await checkConflict(
          date, startTime, endTime, effectiveProcedureId, maxCapacity, id, effectiveScheduleId
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
      }
    }

    const currentAppt = await getWithDetails(id);
    const oldStatus = currentAppt?.status ?? "agendado";

    const updateFields: Record<string, any> = {};
    if (patientId !== undefined) updateFields.patientId = patientId;
    if (procedureId !== undefined) updateFields.procedureId = procedureId;
    if (date !== undefined) updateFields.date = date;
    if (startTime !== undefined) updateFields.startTime = startTime;
    if (endTime !== undefined) updateFields.endTime = endTime;
    if (status !== undefined) updateFields.status = status;
    if (notes !== undefined) updateFields.notes = notes;

    const [appointment] = await db
      .update(appointmentsTable)
      .set(updateFields)
      .where(eq(appointmentsTable.id, id))
      .returning();

    if (!appointment) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    if (status && status !== oldStatus) {
      await applyBillingRules(appointment.id, status, oldStatus);
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
    const id = parseInt(req.params.id as string);
    await db.delete(appointmentsTable).where(eq(appointmentsTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/recurring", requirePermission("appointments.create"), async (req: AuthRequest, res) => {
  try {
    const { patientId, procedureId, date, startTime, notes, recurrence, scheduleId } = req.body;

    if (!patientId || !procedureId || !date || !startTime || !recurrence) {
      res.status(400).json({ error: "Bad Request", message: "patientId, procedureId, date, startTime e recurrence são obrigatórios" });
      return;
    }

    const { daysOfWeek, totalSessions } = recurrence as { daysOfWeek: number[]; totalSessions: number };

    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0 || !totalSessions || totalSessions < 1) {
      res.status(400).json({ error: "Bad Request", message: "recurrence.daysOfWeek e recurrence.totalSessions são obrigatórios" });
      return;
    }

    const [procedure] = await db.select().from(proceduresTable).where(eq(proceduresTable.id, procedureId));
    if (!procedure) {
      res.status(404).json({ error: "Not Found", message: "Procedimento não encontrado" });
      return;
    }

    const resolvedScheduleId = scheduleId ? parseInt(String(scheduleId)) : null;

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
      const dow = cursor.getUTCDay(); // 0=Sun ... 6=Sat
      if (daysOfWeek.includes(dow)) {
        const sessionDate = cursor.toISOString().slice(0, 10);
        const et = endTimeFn(startTime);
        const { conflict, reason, currentCount } = await checkConflict(sessionDate, startTime, et, procedure.id, maxCapacity, undefined, resolvedScheduleId);
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
            professionalId: req.userId,
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

router.post("/:id/complete", requirePermission("appointments.update"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);

    const details = await getWithDetails(id);
    if (!details) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const oldStatus = details.status;

    const [appointment] = await db
      .update(appointmentsTable)
      .set({ status: "concluido" })
      .where(eq(appointmentsTable.id, id))
      .returning();

    await applyBillingRules(id, "concluido", oldStatus);

    const updatedDetails = await getWithDetails(appointment.id);
    res.json(updatedDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
