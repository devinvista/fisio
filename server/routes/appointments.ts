import { Router } from "express";
import { db } from "../../db/index.js";
import { appointmentsTable, patientsTable, proceduresTable, financialRecordsTable } from "../../db/index.js";
import { eq, and, gte, lte, sql, ne } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

// ── helpers ──────────────────────────────────────────────────────────────────

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
    .select({
      appointment: appointmentsTable,
      patient: patientsTable,
      procedure: proceduresTable,
    })
    .from(appointmentsTable)
    .leftJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
    .where(eq(appointmentsTable.id, id))
    .limit(1);

  if (!result[0]) return null;
  const { appointment, patient, procedure } = result[0];
  return { ...appointment, patient, procedure };
}

/**
 * Governance: check whether a time slot is available.
 *
 * Rules:
 * 1. endTime is always derived from startTime + procedure.durationMinutes.
 * 2. A "conflict" exists when another active appointment (not cancelado/faltou)
 *    overlaps the proposed window on the same date.
 * 3. Procedures with maxCapacity > 1 (e.g. Pilates em Grupo) allow multiple
 *    simultaneous bookings up to their capacity.
 * 4. Excludes a specific appointmentId from the count (used on PUT).
 */
async function checkConflict(
  date: string,
  startTime: string,
  endTime: string,
  procedureId: number,
  maxCapacity: number,
  excludeId?: number
): Promise<{ conflict: boolean; currentCount: number }> {
  const baseConditions = [
    eq(appointmentsTable.date, date),
    sql`status NOT IN ('cancelado', 'faltou')`,
    sql`start_time < ${endTime} AND end_time > ${startTime}`,
  ];

  if (maxCapacity > 1) {
    // For multi-capacity procedures: only count bookings of the SAME procedure
    baseConditions.push(eq(appointmentsTable.procedureId, procedureId));
  }

  if (excludeId) {
    baseConditions.push(ne(appointmentsTable.id, excludeId));
  }

  const existing = await db
    .select({ id: appointmentsTable.id })
    .from(appointmentsTable)
    .where(and(...baseConditions));

  const currentCount = existing.length;

  if (maxCapacity > 1) {
    // Multi-capacity: only block when fully booked
    return { conflict: currentCount >= maxCapacity, currentCount };
  } else {
    // Single-capacity (default): any overlap is a conflict
    return { conflict: currentCount > 0, currentCount };
  }
}

// ── routes ───────────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const { date, startDate, endDate, patientId, status } = req.query;

    let query = db
      .select({
        appointment: appointmentsTable,
        patient: patientsTable,
        procedure: proceduresTable,
      })
      .from(appointmentsTable)
      .leftJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id));

    const conditions = [];
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

/**
 * GET /appointments/available-slots
 * Returns available start times for a given date + procedure.
 * Respects procedure duration and existing bookings + capacity rules.
 *
 * Query params: date (yyyy-MM-dd), procedureId, clinicStart (HH:mm, default 08:00), clinicEnd (HH:mm, default 18:00)
 */
router.get("/available-slots", async (req, res) => {
  try {
    const { date, procedureId, clinicStart = "08:00", clinicEnd = "18:00" } = req.query;

    if (!date || !procedureId) {
      res.status(400).json({ error: "date and procedureId are required" });
      return;
    }

    const [procedure] = await db
      .select()
      .from(proceduresTable)
      .where(eq(proceduresTable.id, parseInt(procedureId as string)));

    if (!procedure) {
      res.status(404).json({ error: "Procedure not found" });
      return;
    }

    const openMin = timeToMinutes(clinicStart as string);
    const closeMin = timeToMinutes(clinicEnd as string);
    const duration = procedure.durationMinutes;
    const maxCapacity = procedure.maxCapacity ?? 1;

    // Fetch all active appointments on this date
    const existingAppts = await db
      .select({
        id: appointmentsTable.id,
        procedureId: appointmentsTable.procedureId,
        startTime: appointmentsTable.startTime,
        endTime: appointmentsTable.endTime,
      })
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.date, date as string),
          sql`status NOT IN ('cancelado', 'faltou')`
        )
      );

    const slots: { time: string; available: boolean; spotsLeft: number }[] = [];

    // Generate candidate slots every 30 minutes within clinic hours
    for (let start = openMin; start + duration <= closeMin; start += 30) {
      const startTime = minutesToTime(start);
      const endTime = minutesToTime(start + duration);

      // Count overlapping appointments
      let occupiedCount = 0;

      if (maxCapacity > 1) {
        // For multi-capacity: count same-procedure overlapping bookings
        occupiedCount = existingAppts.filter(
          (a) =>
            a.procedureId === procedure.id &&
            timeToMinutes(a.startTime) < start + duration &&
            timeToMinutes(a.endTime) > start
        ).length;
      } else {
        // For single-capacity: count ANY overlapping booking
        occupiedCount = existingAppts.filter(
          (a) =>
            timeToMinutes(a.startTime) < start + duration &&
            timeToMinutes(a.endTime) > start
        ).length;
      }

      const spotsLeft = Math.max(0, maxCapacity - occupiedCount);
      slots.push({
        time: startTime,
        available: spotsLeft > 0,
        spotsLeft,
      });
    }

    res.json({
      date,
      procedure: {
        id: procedure.id,
        name: procedure.name,
        durationMinutes: procedure.durationMinutes,
        maxCapacity,
      },
      slots,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { patientId, procedureId, date, startTime, notes } = req.body;

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

    // endTime is always derived from procedure duration — never accepted from the client
    const endTime = addMinutes(startTime, procedure.durationMinutes);
    const maxCapacity = procedure.maxCapacity ?? 1;

    const { conflict, currentCount } = await checkConflict(
      date,
      startTime,
      endTime,
      procedure.id,
      maxCapacity
    );

    if (conflict) {
      const message =
        maxCapacity > 1
          ? `Horário lotado: ${currentCount}/${maxCapacity} vagas ocupadas para ${procedure.name} neste horário.`
          : "Conflito de horário: já existe um agendamento neste intervalo.";
      res.status(409).json({ error: "Conflict", message });
      return;
    }

    const [appointment] = await db
      .insert(appointmentsTable)
      .values({ patientId, procedureId, date, startTime, endTime, status: "agendado", notes })
      .returning();

    const details = await getWithDetails(appointment.id);
    res.status(201).json(details);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
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

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { patientId, procedureId, date, startTime, status, notes } = req.body;

    // Recalculate endTime if startTime or procedure changes
    let endTime: string | undefined;
    let maxCapacity = 1;

    if (startTime && procedureId) {
      const [proc] = await db
        .select()
        .from(proceduresTable)
        .where(eq(proceduresTable.id, procedureId));

      if (proc) {
        endTime = addMinutes(startTime, proc.durationMinutes);
        maxCapacity = proc.maxCapacity ?? 1;
      }
    } else if (startTime && !procedureId) {
      // Fetch the current appointment's procedure to recalculate
      const current = await getWithDetails(id);
      if (current?.procedure) {
        endTime = addMinutes(startTime, current.procedure.durationMinutes);
        maxCapacity = (current.procedure as any).maxCapacity ?? 1;
      }
    }

    // Only run conflict check when date/time changes
    if (date && startTime && endTime) {
      const effectiveProcedureId = procedureId ?? (await getWithDetails(id))?.procedureId;
      const { conflict, currentCount } = await checkConflict(
        date,
        startTime,
        endTime,
        effectiveProcedureId,
        maxCapacity,
        id // exclude self
      );

      if (conflict) {
        const proc = await db
          .select()
          .from(proceduresTable)
          .where(eq(proceduresTable.id, effectiveProcedureId))
          .then((r) => r[0]);

        const message =
          maxCapacity > 1
            ? `Horário lotado: ${currentCount}/${maxCapacity} vagas ocupadas neste horário.`
            : "Conflito de horário: já existe um agendamento neste intervalo.";
        res.status(409).json({ error: "Conflict", message });
        return;
      }
    }

    const [appointment] = await db
      .update(appointmentsTable)
      .set({ patientId, procedureId, date, startTime, endTime, status, notes })
      .where(eq(appointmentsTable.id, id))
      .returning();

    if (!appointment) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const details = await getWithDetails(appointment.id);
    res.json(details);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(appointmentsTable).where(eq(appointmentsTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/complete", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const details = await getWithDetails(id);
    if (!details) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const [appointment] = await db
      .update(appointmentsTable)
      .set({ status: "concluido" })
      .where(eq(appointmentsTable.id, id))
      .returning();

    if (details.procedure) {
      await db.insert(financialRecordsTable).values({
        type: "receita",
        amount: String(details.procedure.price),
        description: `${details.procedure.name} - ${details.patient?.name ?? "Paciente"}`,
        category: details.procedure.category,
        appointmentId: id,
      });
    }

    const updatedDetails = await getWithDetails(appointment.id);
    res.json(updatedDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
