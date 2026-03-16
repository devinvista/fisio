import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable, appointmentsTable, financialRecordsTable } from "@workspace/db";
import { eq, ilike, or, sql, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    let query = db.select().from(patientsTable);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(patientsTable);

    if (search) {
      const condition = or(
        ilike(patientsTable.name, `%${search}%`),
        ilike(patientsTable.cpf, `%${search}%`),
        ilike(patientsTable.phone, `%${search}%`)
      );
      query = query.where(condition) as any;
      countQuery = countQuery.where(condition) as any;
    }

    const [patients, countResult] = await Promise.all([
      query.orderBy(desc(patientsTable.createdAt)).limit(limit).offset(offset),
      countQuery
    ]);

    res.json({
      data: patients,
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, cpf, birthDate, phone, email, address, profession, emergencyContact, notes } = req.body;
    if (!name || !cpf || !phone) {
      res.status(400).json({ error: "Bad Request", message: "Name, CPF and phone are required" });
      return;
    }

    const [patient] = await db.insert(patientsTable).values({
      name, cpf, birthDate, phone, email, address, profession, emergencyContact, notes
    }).returning();

    res.status(201).json(patient);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(400).json({ error: "Bad Request", message: "CPF already registered" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));

    if (!patient) {
      res.status(404).json({ error: "Not Found", message: "Patient not found" });
      return;
    }

    const [appointments, spentResult] = await Promise.all([
      db.select({ id: appointmentsTable.id, createdAt: appointmentsTable.createdAt })
        .from(appointmentsTable)
        .where(eq(appointmentsTable.patientId, id))
        .orderBy(desc(appointmentsTable.date)),
      db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(financialRecordsTable)
        .where(eq(financialRecordsTable.appointmentId, sql`(SELECT id FROM appointments WHERE patient_id = ${id} LIMIT 1)`))
    ]);

    const totalSpent = await db.select({ total: sql<number>`COALESCE(SUM(fr.amount), 0)` })
      .from(financialRecordsTable)
      .innerJoin(appointmentsTable, eq(financialRecordsTable.appointmentId, appointmentsTable.id))
      .where(eq(appointmentsTable.patientId, id));

    res.json({
      ...patient,
      totalAppointments: appointments.length,
      lastAppointment: appointments[0]?.createdAt ?? null,
      totalSpent: Number(totalSpent[0]?.total ?? 0)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, cpf, birthDate, phone, email, address, profession, emergencyContact, notes } = req.body;

    const [patient] = await db.update(patientsTable)
      .set({ name, cpf, birthDate, phone, email, address, profession, emergencyContact, notes })
      .where(eq(patientsTable.id, id))
      .returning();

    if (!patient) {
      res.status(404).json({ error: "Not Found", message: "Patient not found" });
      return;
    }
    res.json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(patientsTable).where(eq(patientsTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
