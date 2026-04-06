import { Router } from "express";
import { db } from "@workspace/db";
import { proceduresTable, procedureCostsTable, appointmentsTable } from "@workspace/db";
import { eq, and, count, ilike, isNull, or, sql } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import type { Role } from "@workspace/db";

const router = Router();
router.use(authMiddleware);

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Returns the effective price for a procedure in a specific clinic.
 *  Falls back to the procedure's own price when no clinic override exists. */
export async function getEffectiveProcedurePrice(
  procedureId: number,
  clinicId: number | null
): Promise<string> {
  if (!clinicId) return "";
  const [row] = await db
    .select({
      basePrice: proceduresTable.price,
      priceOverride: procedureCostsTable.priceOverride,
    })
    .from(proceduresTable)
    .leftJoin(
      procedureCostsTable,
      and(
        eq(procedureCostsTable.procedureId, proceduresTable.id),
        eq(procedureCostsTable.clinicId, clinicId)
      )
    )
    .where(eq(proceduresTable.id, procedureId))
    .limit(1);

  if (!row) return "0";
  return row.priceOverride ?? row.basePrice;
}

// ─── GET /  (list) ────────────────────────────────────────────────────────────

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

    // JOIN with procedure_costs for the current clinic (-1 never matches → null clinicCost)
    const clinicIdForJoin = req.clinicId ?? -1;

    const rows = await db
      .select({
        id: proceduresTable.id,
        name: proceduresTable.name,
        category: proceduresTable.category,
        modalidade: proceduresTable.modalidade,
        durationMinutes: proceduresTable.durationMinutes,
        price: proceduresTable.price,
        cost: proceduresTable.cost,
        description: proceduresTable.description,
        maxCapacity: proceduresTable.maxCapacity,
        onlineBookingEnabled: proceduresTable.onlineBookingEnabled,
        billingType: proceduresTable.billingType,
        monthlyPrice: proceduresTable.monthlyPrice,
        billingDay: proceduresTable.billingDay,
        clinicId: proceduresTable.clinicId,
        isActive: proceduresTable.isActive,
        createdAt: proceduresTable.createdAt,
        // Clinic-specific cost override (null when no row in procedure_costs)
        cc_priceOverride: procedureCostsTable.priceOverride,
        cc_monthlyPriceOverride: procedureCostsTable.monthlyPriceOverride,
        cc_fixedCost: procedureCostsTable.fixedCost,
        cc_variableCost: procedureCostsTable.variableCost,
        cc_notes: procedureCostsTable.notes,
      })
      .from(proceduresTable)
      .leftJoin(
        procedureCostsTable,
        and(
          eq(procedureCostsTable.procedureId, proceduresTable.id),
          eq(procedureCostsTable.clinicId, clinicIdForJoin)
        )
      )
      .where(conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(proceduresTable.name);

    const procedures = rows.map((r) => {
      const hasClinicCost = r.cc_fixedCost !== null;
      const fixedCost = r.cc_fixedCost ?? "0";
      const variableCost = r.cc_variableCost ?? "0";
      const effectiveTotalCost = hasClinicCost
        ? String(Number(fixedCost) + Number(variableCost))
        : String(r.cost ?? "0");

      return {
        id: r.id,
        name: r.name,
        category: r.category,
        modalidade: r.modalidade,
        durationMinutes: r.durationMinutes,
        price: r.price,
        cost: r.cost,
        description: r.description,
        maxCapacity: r.maxCapacity,
        onlineBookingEnabled: r.onlineBookingEnabled,
        billingType: r.billingType,
        monthlyPrice: r.monthlyPrice,
        billingDay: r.billingDay,
        clinicId: r.clinicId,
        isActive: r.isActive,
        createdAt: r.createdAt,
        isGlobal: r.clinicId === null,
        effectivePrice: r.cc_priceOverride ?? r.price,
        effectiveMonthlyPrice: r.cc_monthlyPriceOverride ?? r.monthlyPrice ?? null,
        effectiveTotalCost,
        clinicCost: hasClinicCost
          ? {
              priceOverride: r.cc_priceOverride,
              monthlyPriceOverride: r.cc_monthlyPriceOverride,
              fixedCost,
              variableCost,
              notes: r.cc_notes,
            }
          : null,
      };
    });

    res.json(procedures);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST / (create) ──────────────────────────────────────────────────────────

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
    const resolvedMaxCapacity = maxCapacity
      ? parseInt(maxCapacity)
      : resolvedModalidade === "individual" ? 1 : resolvedModalidade === "dupla" ? 2 : 10;

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

    res.status(201).json({ ...procedure, isGlobal: procedure.clinicId === null, clinicCost: null, effectivePrice: procedure.price, effectiveTotalCost: procedure.cost ?? "0" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── PUT /:id (update base data) ──────────────────────────────────────────────

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
    res.json({ ...procedure, isGlobal: procedure.clinicId === null, clinicCost: null, effectivePrice: procedure.price, effectiveTotalCost: procedure.cost ?? "0" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /:id/costs  (clinic-specific cost config) ───────────────────────────

router.get("/:id/costs", requirePermission("procedures.manage"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const clinicId = req.clinicId;

    if (!clinicId) {
      res.status(400).json({ error: "Bad Request", message: "Clínica não selecionada" });
      return;
    }

    const [costs] = await db
      .select()
      .from(procedureCostsTable)
      .where(
        and(
          eq(procedureCostsTable.procedureId, id),
          eq(procedureCostsTable.clinicId, clinicId)
        )
      )
      .limit(1);

    res.json(costs ?? null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── PUT /:id/costs  (upsert clinic-specific costs) ──────────────────────────

router.put("/:id/costs", requirePermission("procedures.manage"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const clinicId = req.clinicId;

    if (!clinicId) {
      res.status(400).json({ error: "Bad Request", message: "Clínica não selecionada" });
      return;
    }

    const isAdmin = req.isSuperAdmin || (req.userRoles ?? []).includes("admin" as Role);
    if (!isAdmin) {
      res.status(403).json({ error: "Forbidden", message: "Apenas administradores podem configurar custos" });
      return;
    }

    const { priceOverride, monthlyPriceOverride, fixedCost, variableCost, notes } = req.body;

    const fixedCostVal = fixedCost !== undefined && fixedCost !== "" ? String(fixedCost) : "0";
    const variableCostVal = variableCost !== undefined && variableCost !== "" ? String(variableCost) : "0";
    const priceOverrideVal = priceOverride !== undefined && priceOverride !== "" ? String(priceOverride) : null;
    const monthlyPriceOverrideVal = monthlyPriceOverride !== undefined && monthlyPriceOverride !== "" ? String(monthlyPriceOverride) : null;

    const existing = await db
      .select({ id: procedureCostsTable.id })
      .from(procedureCostsTable)
      .where(
        and(
          eq(procedureCostsTable.procedureId, id),
          eq(procedureCostsTable.clinicId, clinicId)
        )
      )
      .limit(1);

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(procedureCostsTable)
        .set({
          priceOverride: priceOverrideVal,
          monthlyPriceOverride: monthlyPriceOverrideVal,
          fixedCost: fixedCostVal,
          variableCost: variableCostVal,
          notes: notes || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(procedureCostsTable.procedureId, id),
            eq(procedureCostsTable.clinicId, clinicId)
          )
        )
        .returning();
    } else {
      [result] = await db
        .insert(procedureCostsTable)
        .values({
          procedureId: id,
          clinicId,
          priceOverride: priceOverrideVal,
          monthlyPriceOverride: monthlyPriceOverrideVal,
          fixedCost: fixedCostVal,
          variableCost: variableCostVal,
          notes: notes || null,
        })
        .returning();
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── DELETE /:id/costs  (remove clinic cost override) ────────────────────────

router.delete("/:id/costs", requirePermission("procedures.manage"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const clinicId = req.clinicId;

    if (!clinicId) {
      res.status(400).json({ error: "Bad Request", message: "Clínica não selecionada" });
      return;
    }

    await db
      .delete(procedureCostsTable)
      .where(
        and(
          eq(procedureCostsTable.procedureId, id),
          eq(procedureCostsTable.clinicId, clinicId)
        )
      );

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── PATCH /:id/toggle-active ─────────────────────────────────────────────────

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

    res.json({ ...updated, isGlobal: updated.clinicId === null, clinicCost: null, effectivePrice: updated.price, effectiveTotalCost: updated.cost ?? "0" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── DELETE /:id ─────────────────────────────────────────────────────────────

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

    // procedure_costs rows are deleted automatically by CASCADE
    await db.delete(proceduresTable).where(deleteCondition);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
