import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable, appointmentsTable, financialRecordsTable } from "@workspace/db";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();
router.use(authMiddleware);

router.get("/", requirePermission("patients.read"), async (req, res) => {
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
      countQuery,
    ]);

    res.json({
      data: patients,
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requirePermission("patients.create"), async (req, res) => {
  try {
    const { name, cpf, birthDate, phone, email, address, profession, emergencyContact, notes } = req.body;
    if (!name || !cpf || !phone) {
      res.status(400).json({ error: "Bad Request", message: "Nome, CPF e telefone são obrigatórios" });
      return;
    }

    const [patient] = await db
      .insert(patientsTable)
      .values({ name, cpf, birthDate, phone, email, address, profession, emergencyContact, notes })
      .returning();

    res.status(201).json(patient);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(400).json({ error: "Bad Request", message: "CPF já cadastrado" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", requirePermission("patients.read"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [patient] = await db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.id, id));

    if (!patient) {
      res.status(404).json({ error: "Not Found", message: "Paciente não encontrado" });
      return;
    }

    const [appointments, totalSpent] = await Promise.all([
      db
        .select({ id: appointmentsTable.id, date: appointmentsTable.date, createdAt: appointmentsTable.createdAt })
        .from(appointmentsTable)
        .where(eq(appointmentsTable.patientId, id))
        .orderBy(desc(appointmentsTable.date)),
      db
        .select({ total: sql<number>`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0)` })
        .from(financialRecordsTable)
        .leftJoin(appointmentsTable, eq(financialRecordsTable.appointmentId, appointmentsTable.id))
        .where(
          and(
            eq(financialRecordsTable.type, "receita"),
            or(
              eq(financialRecordsTable.patientId, id),
              eq(appointmentsTable.patientId, id)
            )
          )
        ),
    ]);

    res.json({
      ...patient,
      totalAppointments: appointments.length,
      lastAppointment: appointments[0]?.date ?? null,
      totalSpent: Number(totalSpent[0]?.total ?? 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", requirePermission("patients.update"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, cpf, birthDate, phone, email, address, profession, emergencyContact, notes } = req.body;

    const [patient] = await db
      .update(patientsTable)
      .set({ name, cpf, birthDate, phone, email, address, profession, emergencyContact, notes })
      .where(eq(patientsTable.id, id))
      .returning();

    if (!patient) {
      res.status(404).json({ error: "Not Found", message: "Paciente não encontrado" });
      return;
    }
    res.json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", requirePermission("patients.delete"), async (req, res) => {
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
