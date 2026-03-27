import { Router } from "express";
import { db } from "@workspace/db";
import { proceduresTable, appointmentsTable } from "@workspace/db";
import { eq, and, count, ilike, isNull, or, sql } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import type { Role } from "@workspace/db";

const router = Router();
router.use(authMiddleware);

router.get("/", requirePermission("procedures.manage"), async (req: AuthRequest, res) => {
  try {
    const category = req.query.category as string | undefined;
    const includeInactive = req.query.includeInactive === "true";

    const isAdmin = req.isSuperAdmin || (req.userRoles ?? []).includes("admin" as Role);

    const conditions: any[] = [];
    if (!req.isSuperAdmin && req.clinicId) {
      conditions.push(or(isNull(proceduresTable.clinicId), eq(proceduresTable.clinicId, req.clinicId)));
    }
    if (category) conditions.push(ilike(proceduresTable.category, category));
    if (!isAdmin || !includeInactive) conditions.push(eq(proceduresTable.isActive, true));

    let query = db.select().from(proceduresTable) as any;
    if (conditions.length === 1) {
      query = query.where(conditions[0]);
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions));
    }

    const procedures = await query.orderBy(proceduresTable.name);
    res.json(procedures);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requirePermission("procedures.manage"), async (req: AuthRequest, res) => {
  try {
    const { name, category, modalidade, durationMinutes, price, cost, description, maxCapacity, onlineBookingEnabled, billingType, monthlyPrice, billingDay } = req.body;
    if (!name || !category || !durationMinutes || !price) {
      res.status(400).json({
        error: "Bad Request",
        message: "name, category, durationMinutes e price são obrigatórios",
      });
      return;
    }
    const resolvedBillingType = billingType || "porSessao";
    if (resolvedBillingType === "mensal" && (!monthlyPrice || !billingDay)) {
      res.status(400).json({
        error: "Bad Request",
        message: "Para cobrança mensal, monthlyPrice e billingDay são obrigatórios",
      });
      return;
    }
    const resolvedModalidade = modalidade || "individual";
    const resolvedMaxCapacity = maxCapacity ? parseInt(maxCapacity) : (resolvedModalidade === "individual" ? 1 : resolvedModalidade === "dupla" ? 2 : 10);
    const [procedure] = await db
      .insert(proceduresTable)
      .values({
        name,
        category,
        modalidade: resolvedModalidade,
        durationMinutes: parseInt(durationMinutes),
        price: String(price),
        cost: cost ? String(cost) : "0",
        description,
        maxCapacity: resolvedMaxCapacity,
        onlineBookingEnabled: Boolean(onlineBookingEnabled),
        billingType: resolvedBillingType,
        monthlyPrice: monthlyPrice ? String(monthlyPrice) : null,
        billingDay: billingDay ? parseInt(billingDay) : null,
        isActive: true,
        clinicId: req.clinicId ?? null,
      })
      .returning();
    res.status(201).json(procedure);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", requirePermission("procedures.manage"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, category, modalidade, durationMinutes, price, cost, description, maxCapacity, onlineBookingEnabled, billingType, monthlyPrice, billingDay } = req.body;

    const condition = req.isSuperAdmin || !req.clinicId
      ? eq(proceduresTable.id, id)
      : and(
          eq(proceduresTable.id, id),
          or(isNull(proceduresTable.clinicId), eq(proceduresTable.clinicId, req.clinicId!))
        );

    const [procedure] = await db
      .update(proceduresTable)
      .set({
        name,
        category,
        modalidade: modalidade || undefined,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : undefined,
        price: price ? String(price) : undefined,
        cost: cost !== undefined ? String(cost) : undefined,
        description,
        maxCapacity: maxCapacity !== undefined ? parseInt(maxCapacity) : undefined,
        onlineBookingEnabled: onlineBookingEnabled !== undefined ? Boolean(onlineBookingEnabled) : undefined,
        billingType: billingType || undefined,
        monthlyPrice: monthlyPrice !== undefined ? (monthlyPrice ? String(monthlyPrice) : null) : undefined,
        billingDay: billingDay !== undefined ? (billingDay ? parseInt(billingDay) : null) : undefined,
      })
      .where(condition)
      .returning();

    if (!procedure) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    res.json(procedure);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id/toggle-active", requirePermission("procedures.manage"), async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.isSuperAdmin || (req.userRoles ?? []).includes("admin" as Role);
    if (!isAdmin) {
      res.status(403).json({ error: "Forbidden", message: "Apenas administradores podem ativar/desativar procedimentos." });
      return;
    }

    const id = parseInt(req.params.id as string);
    const condition = req.isSuperAdmin || !req.clinicId
      ? eq(proceduresTable.id, id)
      : and(
          eq(proceduresTable.id, id),
          or(isNull(proceduresTable.clinicId), eq(proceduresTable.clinicId, req.clinicId!))
        );

    const existing = await db.select().from(proceduresTable).where(condition).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const [updated] = await db
      .update(proceduresTable)
      .set({ isActive: !existing[0].isActive })
      .where(eq(proceduresTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", requirePermission("procedures.manage"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);

    const deleteCondition = req.isSuperAdmin || !req.clinicId
      ? eq(proceduresTable.id, id)
      : and(
          eq(proceduresTable.id, id),
          or(isNull(proceduresTable.clinicId), eq(proceduresTable.clinicId, req.clinicId!))
        );

    const [{ total }] = await db
      .select({ total: count() })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.procedureId, id));

    if (total > 0) {
      res.status(409).json({
        error: "Conflict",
        message: `Este procedimento não pode ser removido pois está vinculado a ${total} consulta(s). Remova ou reatribua as consultas antes de excluí-lo.`,
      });
      return;
    }

    await db.delete(proceduresTable).where(deleteCondition);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
