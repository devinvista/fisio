import { Router } from "express";
import { db } from "@workspace/db";
import { patientPackagesTable, packagesTable, proceduresTable, patientsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router({ mergeParams: true });
router.use(authMiddleware);

router.get("/", requirePermission("patients.read"), async (req: AuthRequest, res) => {
  try {
    const patientId = req.params.patientId ? parseInt(req.params.patientId as string) : undefined;

    const conditions: any[] = [];
    if (patientId) conditions.push(eq(patientPackagesTable.patientId, patientId));
    if (!req.isSuperAdmin && req.clinicId) {
      conditions.push(eq(patientPackagesTable.clinicId, req.clinicId));
    }

    let query = db
      .select({
        id: patientPackagesTable.id,
        patientId: patientPackagesTable.patientId,
        packageId: patientPackagesTable.packageId,
        procedureId: patientPackagesTable.procedureId,
        procedureName: proceduresTable.name,
        procedureCategory: proceduresTable.category,
        procedureModalidade: proceduresTable.modalidade,
        name: patientPackagesTable.name,
        totalSessions: patientPackagesTable.totalSessions,
        usedSessions: patientPackagesTable.usedSessions,
        sessionsPerWeek: patientPackagesTable.sessionsPerWeek,
        startDate: patientPackagesTable.startDate,
        expiryDate: patientPackagesTable.expiryDate,
        price: patientPackagesTable.price,
        paymentStatus: patientPackagesTable.paymentStatus,
        notes: patientPackagesTable.notes,
        clinicId: patientPackagesTable.clinicId,
        createdAt: patientPackagesTable.createdAt,
      })
      .from(patientPackagesTable)
      .innerJoin(proceduresTable, eq(patientPackagesTable.procedureId, proceduresTable.id)) as any;

    if (conditions.length === 1) {
      query = query.where(conditions[0]);
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions));
    }

    const result = await query.orderBy(patientPackagesTable.createdAt);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requirePermission("patients.write"), async (req: AuthRequest, res) => {
  try {
    const patientId = req.params.patientId
      ? parseInt(req.params.patientId as string)
      : req.body.patientId
        ? parseInt(req.body.patientId)
        : undefined;

    if (!patientId) {
      res.status(400).json({ error: "Bad Request", message: "patientId é obrigatório" });
      return;
    }

    const { packageId, procedureId, name, totalSessions, sessionsPerWeek, startDate, expiryDate, price, paymentStatus, notes } = req.body;

    if (!procedureId || !name || !totalSessions || !startDate || !price) {
      res.status(400).json({
        error: "Bad Request",
        message: "procedureId, name, totalSessions, startDate e price são obrigatórios",
      });
      return;
    }

    const [pp] = await db
      .insert(patientPackagesTable)
      .values({
        patientId,
        packageId: packageId ? parseInt(packageId) : null,
        procedureId: parseInt(procedureId),
        name,
        totalSessions: parseInt(totalSessions),
        usedSessions: 0,
        sessionsPerWeek: sessionsPerWeek ? parseInt(sessionsPerWeek) : 1,
        startDate,
        expiryDate: expiryDate || null,
        price: String(price),
        paymentStatus: paymentStatus || "pendente",
        notes: notes || null,
        clinicId: req.clinicId ?? null,
      })
      .returning();

    res.status(201).json(pp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id/consume-session", requirePermission("appointments.write"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);

    const condition = req.isSuperAdmin || !req.clinicId
      ? eq(patientPackagesTable.id, id)
      : and(eq(patientPackagesTable.id, id), eq(patientPackagesTable.clinicId, req.clinicId!));

    const [existing] = await db
      .select()
      .from(patientPackagesTable)
      .where(condition)
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    if (existing.usedSessions >= existing.totalSessions) {
      res.status(409).json({
        error: "Conflict",
        message: "Este pacote já foi totalmente utilizado (todas as sessões foram consumidas)",
      });
      return;
    }

    const [updated] = await db
      .update(patientPackagesTable)
      .set({ usedSessions: existing.usedSessions + 1 })
      .where(eq(patientPackagesTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", requirePermission("patients.write"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);

    const condition = req.isSuperAdmin || !req.clinicId
      ? eq(patientPackagesTable.id, id)
      : and(eq(patientPackagesTable.id, id), eq(patientPackagesTable.clinicId, req.clinicId!));

    const { name, sessionsPerWeek, expiryDate, paymentStatus, notes } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (sessionsPerWeek !== undefined) updateData.sessionsPerWeek = parseInt(sessionsPerWeek);
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate;
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (notes !== undefined) updateData.notes = notes;

    const [updated] = await db
      .update(patientPackagesTable)
      .set(updateData)
      .where(condition)
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", requirePermission("patients.write"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);

    const condition = req.isSuperAdmin || !req.clinicId
      ? eq(patientPackagesTable.id, id)
      : and(eq(patientPackagesTable.id, id), eq(patientPackagesTable.clinicId, req.clinicId!));

    await db.delete(patientPackagesTable).where(condition);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
