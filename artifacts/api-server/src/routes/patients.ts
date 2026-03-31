import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable, appointmentsTable, financialRecordsTable } from "@workspace/db";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { logAudit } from "../lib/auditLog.js";

function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

function validateCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return false;
  // Reject all-same-digit sequences (000...000, 111...111, etc.)
  if (/^(\d)\1{10}$/.test(d)) return false;
  // First check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(d[9])) return false;
  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(d[10])) return false;
  return true;
}

function isDuplicateKeyError(err: any): boolean {
  return err?.code === "23505" || err?.cause?.code === "23505";
}

const router = Router();
router.use(authMiddleware);

function clinicFilter(req: AuthRequest) {
  if (req.isSuperAdmin || !req.clinicId) return null;
  return eq(patientsTable.clinicId, req.clinicId);
}

router.get("/", requirePermission("patients.read"), async (req: AuthRequest, res) => {
  try {
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const clinicCondition = clinicFilter(req);
    const normalizedSearch = search ? normalizeCpf(search) : null;
    const searchCondition = search
      ? or(
          ilike(patientsTable.name, `%${search}%`),
          ilike(patientsTable.cpf, `%${search}%`),
          normalizedSearch && normalizedSearch.length >= 3
            ? ilike(patientsTable.cpf, `%${normalizedSearch}%`)
            : undefined,
          ilike(patientsTable.phone, `%${search}%`)
        )
      : null;

    const whereCondition =
      clinicCondition && searchCondition
        ? and(clinicCondition, searchCondition)
        : clinicCondition ?? searchCondition ?? undefined;

    const [patients, countResult] = await Promise.all([
      db
        .select()
        .from(patientsTable)
        .where(whereCondition)
        .orderBy(desc(patientsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(patientsTable)
        .where(whereCondition),
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

router.post("/", requirePermission("patients.create"), async (req: AuthRequest, res) => {
  try {
    const { name, cpf, birthDate, phone, email, address, profession, emergencyContact, notes } = req.body;
    if (!name || !cpf || !phone) {
      res.status(400).json({ error: "Bad Request", message: "Nome, CPF e telefone são obrigatórios" });
      return;
    }

    const normalizedCpf = normalizeCpf(cpf);
    if (!validateCpf(normalizedCpf)) {
      res.status(400).json({ error: "Bad Request", message: "CPF inválido. Verifique os dígitos informados." });
      return;
    }

    const [patient] = await db
      .insert(patientsTable)
      .values({
        name,
        cpf: normalizedCpf,
        birthDate: birthDate || null,
        phone,
        email: email || null,
        address: address || null,
        profession: profession || null,
        emergencyContact: emergencyContact || null,
        notes: notes || null,
        clinicId: req.clinicId ?? null,
      })
      .returning();

    await logAudit({
      userId: req.userId,
      patientId: patient?.id,
      action: "create",
      entityType: "patient",
      entityId: patient?.id,
      summary: `Paciente cadastrado: ${name}`,
    });
    res.status(201).json(patient);
  } catch (err: any) {
    if (isDuplicateKeyError(err)) {
      res.status(409).json({ error: "Conflict", message: "CPF já cadastrado" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", requirePermission("patients.read"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const condition = req.isSuperAdmin || !req.clinicId
      ? eq(patientsTable.id, id)
      : and(eq(patientsTable.id, id), eq(patientsTable.clinicId, req.clinicId!));

    const [patient] = await db
      .select()
      .from(patientsTable)
      .where(condition);

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

router.put("/:id", requirePermission("patients.update"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, birthDate, phone, email, address, profession, emergencyContact, notes } = req.body;
    let { cpf } = req.body;

    if (cpf !== undefined) {
      const normalizedCpf = normalizeCpf(cpf);
      if (!validateCpf(normalizedCpf)) {
        res.status(400).json({ error: "Bad Request", message: "CPF inválido. Verifique os dígitos informados." });
        return;
      }
      cpf = normalizedCpf;
    }

    const condition = req.isSuperAdmin || !req.clinicId
      ? eq(patientsTable.id, id)
      : and(eq(patientsTable.id, id), eq(patientsTable.clinicId, req.clinicId!));

    const [patient] = await db
      .update(patientsTable)
      .set({
        name,
        cpf,
        birthDate: birthDate !== undefined ? (birthDate || null) : undefined,
        phone,
        email: email !== undefined ? (email || null) : undefined,
        address: address !== undefined ? (address || null) : undefined,
        profession: profession !== undefined ? (profession || null) : undefined,
        emergencyContact: emergencyContact !== undefined ? (emergencyContact || null) : undefined,
        notes: notes !== undefined ? (notes || null) : undefined,
      })
      .where(condition)
      .returning();

    if (!patient) {
      res.status(404).json({ error: "Not Found", message: "Paciente não encontrado" });
      return;
    }
    await logAudit({
      userId: req.userId,
      patientId: id,
      action: "update",
      entityType: "patient",
      entityId: id,
      summary: `Dados cadastrais do paciente atualizados`,
    });
    res.json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", requirePermission("patients.delete"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);

    const condition = req.isSuperAdmin || !req.clinicId
      ? eq(patientsTable.id, id)
      : and(eq(patientsTable.id, id), eq(patientsTable.clinicId, req.clinicId!));

    const [existing] = await db
      .select({ name: patientsTable.name })
      .from(patientsTable)
      .where(condition);

    if (!existing) {
      res.status(404).json({ error: "Not Found", message: "Paciente não encontrado" });
      return;
    }

    await db.delete(patientsTable).where(eq(patientsTable.id, id));

    await logAudit({
      userId: req.userId,
      patientId: null,
      action: "delete",
      entityType: "patient",
      entityId: id,
      summary: `Paciente excluído: ${existing?.name ?? `ID ${id}`}`,
    });

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
