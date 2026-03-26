import { Router } from "express";
import { db } from "@workspace/db";
import { treatmentPlanProceduresTable, treatmentPlansTable, proceduresTable, packagesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router({ mergeParams: true });
router.use(authMiddleware);

router.get("/", requirePermission("patients.read"), async (req: AuthRequest, res) => {
  try {
    const planId = parseInt(req.params.planId as string);

    const rawItems = await db
      .select({
        id: treatmentPlanProceduresTable.id,
        planId: treatmentPlanProceduresTable.treatmentPlanId,
        procedureId: treatmentPlanProceduresTable.procedureId,
        packageId: treatmentPlanProceduresTable.packageId,
        sessionsPerWeek: treatmentPlanProceduresTable.sessionsPerWeek,
        totalSessions: treatmentPlanProceduresTable.totalSessions,
        priority: treatmentPlanProceduresTable.priority,
        notes: treatmentPlanProceduresTable.notes,
        createdAt: treatmentPlanProceduresTable.createdAt,
      })
      .from(treatmentPlanProceduresTable)
      .where(eq(treatmentPlanProceduresTable.treatmentPlanId, planId))
      .orderBy(treatmentPlanProceduresTable.priority);

    const enriched = await Promise.all(
      rawItems.map(async (item) => {
        if (item.packageId) {
          const [pkg] = await db
            .select({
              id: packagesTable.id,
              name: packagesTable.name,
              packageType: packagesTable.packageType,
              totalSessions: packagesTable.totalSessions,
              sessionsPerWeek: packagesTable.sessionsPerWeek,
              validityDays: packagesTable.validityDays,
              price: packagesTable.price,
              monthlyPrice: packagesTable.monthlyPrice,
              billingDay: packagesTable.billingDay,
              absenceCreditLimit: packagesTable.absenceCreditLimit,
              procedureName: proceduresTable.name,
            })
            .from(packagesTable)
            .innerJoin(proceduresTable, eq(packagesTable.procedureId, proceduresTable.id))
            .where(eq(packagesTable.id, item.packageId))
            .limit(1);

          if (pkg) {
            return {
              ...item,
              packageName: pkg.name,
              procedureName: pkg.procedureName,
              packageType: pkg.packageType,
              totalSessions: item.totalSessions ?? pkg.totalSessions,
              sessionsPerWeek: item.sessionsPerWeek ?? pkg.sessionsPerWeek,
              price: pkg.price,
              monthlyPrice: pkg.monthlyPrice,
              billingDay: pkg.billingDay,
              absenceCreditLimit: pkg.absenceCreditLimit,
            };
          }
          return item;
        }

        if (item.procedureId) {
          const [proc] = await db
            .select({
              id: proceduresTable.id,
              name: proceduresTable.name,
              price: proceduresTable.price,
              category: proceduresTable.category,
              modalidade: proceduresTable.modalidade,
              durationMinutes: proceduresTable.durationMinutes,
            })
            .from(proceduresTable)
            .where(eq(proceduresTable.id, item.procedureId))
            .limit(1);

          if (proc) {
            return {
              ...item,
              procedureName: proc.name,
              packageType: null,
              price: proc.price,
              monthlyPrice: null,
            };
          }
          return item;
        }

        return item;
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requirePermission("patients.write"), async (req: AuthRequest, res) => {
  try {
    const planId = parseInt(req.params.planId as string);
    const { procedureId, packageId, sessionsPerWeek, totalSessions, priority, notes } = req.body;

    if (!procedureId && !packageId) {
      res.status(400).json({ error: "Bad Request", message: "procedureId ou packageId é obrigatório" });
      return;
    }

    const [item] = await db
      .insert(treatmentPlanProceduresTable)
      .values({
        treatmentPlanId: planId,
        procedureId: procedureId ? parseInt(procedureId) : null,
        packageId: packageId ? parseInt(packageId) : null,
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
    const { procedureId, packageId, sessionsPerWeek, totalSessions, priority, notes } = req.body;

    const updateData: any = {};
    if (procedureId !== undefined) updateData.procedureId = procedureId ? parseInt(procedureId) : null;
    if (packageId !== undefined) updateData.packageId = packageId ? parseInt(packageId) : null;
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
