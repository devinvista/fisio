import { Router } from "express";
import { db } from "@workspace/db";
import { packagesTable, proceduresTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();
router.use(authMiddleware);

router.get("/", requirePermission("procedures.manage"), async (req: AuthRequest, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";

    const conditions: any[] = [];
    if (!req.isSuperAdmin && req.clinicId) {
      conditions.push(eq(packagesTable.clinicId, req.clinicId));
    }
    if (!includeInactive) {
      conditions.push(eq(packagesTable.isActive, true));
    }

    let query = db
      .select({
        id: packagesTable.id,
        name: packagesTable.name,
        description: packagesTable.description,
        procedureId: packagesTable.procedureId,
        procedureName: proceduresTable.name,
        procedureCategory: proceduresTable.category,
        procedureModalidade: proceduresTable.modalidade,
        totalSessions: packagesTable.totalSessions,
        sessionsPerWeek: packagesTable.sessionsPerWeek,
        validityDays: packagesTable.validityDays,
        price: packagesTable.price,
        isActive: packagesTable.isActive,
        clinicId: packagesTable.clinicId,
        createdAt: packagesTable.createdAt,
      })
      .from(packagesTable)
      .innerJoin(proceduresTable, eq(packagesTable.procedureId, proceduresTable.id)) as any;

    if (conditions.length === 1) {
      query = query.where(conditions[0]);
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions));
    }

    const packages = await query.orderBy(packagesTable.name);
    res.json(packages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", requirePermission("procedures.manage"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);

    const condition = req.isSuperAdmin || !req.clinicId
      ? eq(packagesTable.id, id)
      : and(eq(packagesTable.id, id), eq(packagesTable.clinicId, req.clinicId!));

    const [pkg] = await db
      .select()
      .from(packagesTable)
      .where(condition)
      .limit(1);

    if (!pkg) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    res.json(pkg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requirePermission("procedures.manage"), async (req: AuthRequest, res) => {
  try {
    const { name, description, procedureId, totalSessions, sessionsPerWeek, validityDays, price } = req.body;

    if (!name || !procedureId || !totalSessions || !price) {
      res.status(400).json({
        error: "Bad Request",
        message: "name, procedureId, totalSessions e price são obrigatórios",
      });
      return;
    }

    const [pkg] = await db
      .insert(packagesTable)
      .values({
        name,
        description: description || null,
        procedureId: parseInt(procedureId),
        totalSessions: parseInt(totalSessions),
        sessionsPerWeek: sessionsPerWeek ? parseInt(sessionsPerWeek) : 1,
        validityDays: validityDays ? parseInt(validityDays) : 30,
        price: String(price),
        isActive: true,
        clinicId: req.clinicId ?? null,
      })
      .returning();

    res.status(201).json(pkg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", requirePermission("procedures.manage"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, description, procedureId, totalSessions, sessionsPerWeek, validityDays, price, isActive } = req.body;

    const condition = req.isSuperAdmin || !req.clinicId
      ? eq(packagesTable.id, id)
      : and(eq(packagesTable.id, id), eq(packagesTable.clinicId, req.clinicId!));

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (procedureId !== undefined) updateData.procedureId = parseInt(procedureId);
    if (totalSessions !== undefined) updateData.totalSessions = parseInt(totalSessions);
    if (sessionsPerWeek !== undefined) updateData.sessionsPerWeek = parseInt(sessionsPerWeek);
    if (validityDays !== undefined) updateData.validityDays = parseInt(validityDays);
    if (price !== undefined) updateData.price = String(price);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const [pkg] = await db
      .update(packagesTable)
      .set(updateData)
      .where(condition)
      .returning();

    if (!pkg) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    res.json(pkg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", requirePermission("procedures.manage"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);

    const condition = req.isSuperAdmin || !req.clinicId
      ? eq(packagesTable.id, id)
      : and(eq(packagesTable.id, id), eq(packagesTable.clinicId, req.clinicId!));

    await db.delete(packagesTable).where(condition);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
