import { Router } from "express";
import { db } from "../../db/index.js";
import { appointmentsTable, patientsTable, proceduresTable, financialRecordsTable } from "../../db/index.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

async function getWithDetails(id: number) {
  const result = await db
    .select({
      appointment: appointmentsTable,
      patient: patientsTable,
      procedure: proceduresTable
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

router.get("/", async (req, res) => {
  try {
    const { date, startDate, endDate, patientId, status } = req.query;

    let query = db
      .select({
        appointment: appointmentsTable,
        patient: patientsTable,
        procedure: proceduresTable
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
      procedure
    }));

    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { patientId, procedureId, date, startTime, notes } = req.body;
    if (!patientId || !procedureId || !date || !startTime) {
      res.status(400).json({ error: "Bad Request", message: "patientId, procedureId, date and startTime are required" });
      return;
    }

    const [procedure] = await db.select().from(proceduresTable).where(eq(proceduresTable.id, procedureId));
    if (!procedure) {
      res.status(404).json({ error: "Not Found", message: "Procedure not found" });
      return;
    }

    const endTime = addMinutes(startTime, procedure.durationMinutes);

    const conflict = await db.select().from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.date, date),
          sql`status NOT IN ('cancelado', 'faltou')`,
          sql`start_time < ${endTime} AND end_time > ${startTime}`
        )
      ).limit(1);

    if (conflict.length > 0) {
      res.status(409).json({ error: "Conflict", message: "Time slot is not available" });
      return;
    }

    const [appointment] = await db.insert(appointmentsTable)
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

    let endTime: string | undefined;
    if (startTime && procedureId) {
      const [proc] = await db.select().from(proceduresTable).where(eq(proceduresTable.id, procedureId));
      if (proc) endTime = addMinutes(startTime, proc.durationMinutes);
    }

    const [appointment] = await db.update(appointmentsTable)
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

    const [appointment] = await db.update(appointmentsTable)
      .set({ status: "concluido" })
      .where(eq(appointmentsTable.id, id))
      .returning();

    if (details.procedure) {
      await db.insert(financialRecordsTable).values({
        type: "receita",
        amount: String(details.procedure.price),
        description: `${details.procedure.name} - ${details.patient?.name ?? "Paciente"}`,
        category: details.procedure.category,
        appointmentId: id
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
