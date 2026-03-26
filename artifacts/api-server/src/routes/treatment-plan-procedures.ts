import { Router } from "express";
import { db } from "@workspace/db";
import { treatmentPlanProceduresTable, treatmentPlansTable, proceduresTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router({ mergeParams: true });
router.use(authMiddleware);

router.get("/", requirePermission("patients.read"), async (req: AuthRequest, res) => {
  try {
    const planId = parseInt(req.params.planId as string);

    const items = await db
      .select({
        id: treatmentPlanProceduresTable.id,
        treatmentPlanId: treatmentPlanProceduresTable.treatmentPlanId,
        procedureId: treatmentPlanProceduresTable.procedureId,
        procedureName: proceduresTable.name,
        procedureCategory: proceduresTable.category,
        procedureModalidade: proceduresTable.modalidade,
        procedureDurationMinutes: proceduresTable.durationMinutes,
        sessionsPerWeek: treatmentPlanProceduresTable.sessionsPerWeek,
        totalSessions: treatmentPlanProceduresTable.totalSessions,
        priority: treatmentPlanProceduresTable.priority,
        notes: treatmentPlanProceduresTable.notes,
        createdAt: treatmentPlanProceduresTable.createdAt,
      })
      .from(treatmentPlanProceduresTable)
      .innerJoin(proceduresTable, eq(treatmentPlanProceduresTable.procedureId, proceduresTable.id))
      .where(eq(treatmentPlanProceduresTable.treatmentPlanId, planId))
      .orderBy(treatmentPlanProceduresTable.priority);

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requirePermission("patients.write"), async (req: AuthRequest, res) => {
  try {
    const planId = parseInt(req.params.planId as string);
    const { procedureId, sessionsPerWeek, totalSessions, priority, notes } = req.body;

    if (!procedureId) {
      res.status(400).json({ error: "Bad Request", message: "procedureId é obrigatório" });
      return;
    }

    const [item] = await db
      .insert(treatmentPlanProceduresTable)
      .values({
        treatmentPlanId: planId,
        procedureId: parseInt(procedureId),
        sessionsPerWeek: sessionsPerWeek ? parseInt(sessionsPerWeek) : 1,
        totalSessions: totalSessions ? parseInt(totalSessions) : null,
        priority: priority ? parseInt(priority) : 1,
        notes: notes || null,
      })
      .returning();

    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", requirePermission("patients.write"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { procedureId, sessionsPerWeek, totalSessions, priority, notes } = req.body;

    const updateData: any = {};
    if (procedureId !== undefined) updateData.procedureId = parseInt(procedureId);
    if (sessionsPerWeek !== undefined) updateData.sessionsPerWeek = parseInt(sessionsPerWeek);
    if (totalSessions !== undefined) updateData.totalSessions = totalSessions ? parseInt(totalSessions) : null;
    if (priority !== undefined) updateData.priority = parseInt(priority);
    if (notes !== undefined) updateData.notes = notes;

    const [updated] = await db
      .update(treatmentPlanProceduresTable)
      .set(updateData)
      .where(eq(treatmentPlanProceduresTable.id, id))
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
    await db.delete(treatmentPlanProceduresTable).where(eq(treatmentPlanProceduresTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
