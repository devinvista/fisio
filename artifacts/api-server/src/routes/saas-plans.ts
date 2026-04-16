import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionPlansTable, clinicSubscriptionsTable, clinicsTable } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requireSuperAdmin } from "../middleware/rbac.js";
import { z } from "zod/v4";
import { validateBody } from "../lib/validate.js";
import { todayBRT } from "../lib/dateUtils.js";

const router = Router();
router.use(authMiddleware);

const planSchema = z.object({
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  description: z.string().max(300).optional().default(""),
  price: z.number().nonnegative(),
  maxProfessionals: z.number().int().positive().nullable().optional(),
  maxPatients: z.number().int().positive().nullable().optional(),
  maxSchedules: z.number().int().positive().nullable().optional(),
  maxUsers: z.number().int().positive().nullable().optional(),
  trialDays: z.number().int().nonnegative().optional().default(30),
  features: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

const subscriptionSchema = z.object({
  clinicId: z.number().int().positive(),
  planId: z.number().int().positive(),
  status: z.enum(["trial", "active", "suspended", "cancelled"]).optional().default("trial"),
  trialStartDate: z.string().nullable().optional(),
  trialEndDate: z.string().nullable().optional(),
  currentPeriodStart: z.string().nullable().optional(),
  currentPeriodEnd: z.string().nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
  paymentStatus: z.enum(["pending", "paid", "overdue", "free"]).optional().default("pending"),
  notes: z.string().max(500).nullable().optional(),
});

const updateSubscriptionSchema = z.object({
  planId: z.number().int().positive().optional(),
  status: z.enum(["trial", "active", "suspended", "cancelled"]).optional(),
  trialStartDate: z.string().nullable().optional(),
  trialEndDate: z.string().nullable().optional(),
  currentPeriodStart: z.string().nullable().optional(),
  currentPeriodEnd: z.string().nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
  paymentStatus: z.enum(["pending", "paid", "overdue", "free"]).optional(),
  paidAt: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

// ─── Default plans seed data ─────────────────────────────────────────────────

const DEFAULT_PLANS = [
  {
    name: "essencial",
    displayName: "Essencial",
    description: "Para profissionais autônomos que estão começando",
    price: "149.00",
    maxProfessionals: 1,
    maxPatients: 150,
    maxSchedules: null,
    maxUsers: 3,
    trialDays: 14,
    features: [
      "1 profissional",
      "Até 150 pacientes",
      "Agenda completa",
      "Prontuários digitais",
      "Controle financeiro básico",
      "Suporte por e-mail",
    ],
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "profissional",
    displayName: "Profissional",
    description: "Para clínicas em crescimento com múltiplos profissionais",
    price: "299.00",
    maxProfessionals: 5,
    maxPatients: 600,
    maxSchedules: null,
    maxUsers: 10,
    trialDays: 30,
    features: [
      "Até 5 profissionais",
      "Até 600 pacientes",
      "Agenda completa",
      "Prontuários digitais",
      "Controle financeiro completo",
      "Relatórios avançados",
      "Assinaturas de pacientes",
      "Suporte prioritário",
    ],
    isActive: true,
    sortOrder: 2,
  },
  {
    name: "premium",
    displayName: "Premium",
    description: "Para clínicas estabelecidas que precisam do máximo",
    price: "499.00",
    maxProfessionals: null,
    maxPatients: null,
    maxSchedules: null,
    maxUsers: null,
    trialDays: 30,
    features: [
      "Profissionais ilimitados",
      "Pacientes ilimitados",
      "Agenda completa",
      "Prontuários digitais",
      "Controle financeiro completo",
      "Relatórios avançados",
      "Assinaturas de pacientes",
      "API de integração",
      "White-label",
      "Suporte dedicado",
    ],
    isActive: true,
    sortOrder: 3,
  },
];

// ─── Plans CRUD (superadmin only) ────────────────────────────────────────────

router.get("/plans", requireSuperAdmin(), async (_req, res) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlansTable)
      .orderBy(asc(subscriptionPlansTable.sortOrder));
    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Seed default plans if they don't exist
router.post("/plans/seed-defaults", requireSuperAdmin(), async (_req, res) => {
  try {
    const results: { name: string; action: string }[] = [];

    for (const plan of DEFAULT_PLANS) {
      const existing = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.name, plan.name))
        .limit(1);

      if (existing.length > 0) {
        results.push({ name: plan.name, action: "skipped" });
      } else {
        await db.insert(subscriptionPlansTable).values(plan);
        results.push({ name: plan.name, action: "created" });
      }
    }

    res.json({ ok: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Per-plan stats for dashboard
router.get("/plans/stats", requireSuperAdmin(), async (_req, res) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlansTable)
      .orderBy(asc(subscriptionPlansTable.sortOrder));

    const subs = await db
      .select({
        sub: clinicSubscriptionsTable,
      })
      .from(clinicSubscriptionsTable);

    const stats = plans.map((plan) => {
      const planSubs = subs.filter((s) => s.sub.planId === plan.id);
      const active = planSubs.filter((s) => s.sub.status === "active").length;
      const trial = planSubs.filter((s) => s.sub.status === "trial").length;
      const suspended = planSubs.filter((s) => s.sub.status === "suspended").length;
      const cancelled = planSubs.filter((s) => s.sub.status === "cancelled").length;
      const mrr = planSubs
        .filter((s) => s.sub.status === "active" && s.sub.paymentStatus === "paid")
        .reduce((acc, s) => acc + Number(s.sub.amount ?? 0), 0);

      return {
        planId: plan.id,
        planName: plan.name,
        planDisplayName: plan.displayName,
        price: plan.price,
        total: planSubs.length,
        active,
        trial,
        suspended,
        cancelled,
        mrr,
      };
    });

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/plans/public", async (_req, res) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.isActive, true))
      .orderBy(asc(subscriptionPlansTable.sortOrder));
    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/plans", requireSuperAdmin(), async (req, res) => {
  try {
    const body = validateBody(planSchema, req.body, res);
    if (!body) return;

    const [plan] = await db
      .insert(subscriptionPlansTable)
      .values({
        name: body.name,
        displayName: body.displayName,
        description: body.description ?? "",
        price: String(body.price),
        maxProfessionals: body.maxProfessionals ?? null,
        maxPatients: body.maxPatients ?? null,
        maxSchedules: body.maxSchedules ?? null,
        maxUsers: body.maxUsers ?? null,
        trialDays: body.trialDays ?? 30,
        features: body.features ?? [],
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(plan);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(400).json({ error: "Bad Request", message: "Já existe um plano com esse identificador." });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/plans/:id", requireSuperAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = validateBody(planSchema.partial(), req.body, res);
    if (!body) return;

    const updateData: Partial<typeof subscriptionPlansTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.displayName !== undefined) updateData.displayName = body.displayName;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.price !== undefined) updateData.price = String(body.price);
    if (body.maxProfessionals !== undefined) updateData.maxProfessionals = body.maxProfessionals ?? null;
    if (body.maxPatients !== undefined) updateData.maxPatients = body.maxPatients ?? null;
    if (body.maxSchedules !== undefined) updateData.maxSchedules = body.maxSchedules ?? null;
    if (body.maxUsers !== undefined) updateData.maxUsers = body.maxUsers ?? null;
    if (body.trialDays !== undefined) updateData.trialDays = body.trialDays;
    if (body.features !== undefined) updateData.features = body.features;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

    const [plan] = await db
      .update(subscriptionPlansTable)
      .set(updateData)
      .where(eq(subscriptionPlansTable.id, id))
      .returning();

    if (!plan) {
      res.status(404).json({ error: "Not Found", message: "Plano não encontrado" });
      return;
    }
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/plans/:id", requireSuperAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Clinic Subscriptions (superadmin only) ───────────────────────────────────

router.get("/clinic-subscriptions", requireSuperAdmin(), async (_req, res) => {
  try {
    const rows = await db
      .select({
        sub: clinicSubscriptionsTable,
        clinic: {
          id: clinicsTable.id,
          name: clinicsTable.name,
          email: clinicsTable.email,
          isActive: clinicsTable.isActive,
          createdAt: clinicsTable.createdAt,
        },
        plan: subscriptionPlansTable,
      })
      .from(clinicSubscriptionsTable)
      .leftJoin(clinicsTable, eq(clinicSubscriptionsTable.clinicId, clinicsTable.id))
      .leftJoin(subscriptionPlansTable, eq(clinicSubscriptionsTable.planId, subscriptionPlansTable.id))
      .orderBy(desc(clinicSubscriptionsTable.createdAt));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/clinic-subscriptions", requireSuperAdmin(), async (req, res) => {
  try {
    const body = validateBody(subscriptionSchema, req.body, res);
    if (!body) return;

    const plan = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, body.planId))
      .limit(1);

    if (!plan[0]) {
      res.status(404).json({ error: "Not Found", message: "Plano não encontrado" });
      return;
    }

    const today = todayBRT();
    const trialEnd = new Date(today);
    trialEnd.setDate(trialEnd.getDate() + (plan[0].trialDays ?? 30));

    const [sub] = await db
      .insert(clinicSubscriptionsTable)
      .values({
        clinicId: body.clinicId,
        planId: body.planId,
        status: body.status ?? "trial",
        trialStartDate: body.trialStartDate ?? today,
        trialEndDate: body.trialEndDate ?? trialEnd.toISOString().split("T")[0],
        currentPeriodStart: body.currentPeriodStart ?? null,
        currentPeriodEnd: body.currentPeriodEnd ?? null,
        amount: body.amount != null ? String(body.amount) : String(plan[0].price),
        paymentStatus: body.paymentStatus ?? "pending",
        notes: body.notes ?? null,
      })
      .returning();

    res.status(201).json(sub);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/clinic-subscriptions/:id", requireSuperAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = validateBody(updateSubscriptionSchema, req.body, res);
    if (!body) return;

    const updateData: Partial<typeof clinicSubscriptionsTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.planId !== undefined) updateData.planId = body.planId;
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === "cancelled") updateData.cancelledAt = new Date();
    }
    if (body.trialStartDate !== undefined) updateData.trialStartDate = body.trialStartDate ?? null;
    if (body.trialEndDate !== undefined) updateData.trialEndDate = body.trialEndDate ?? null;
    if (body.currentPeriodStart !== undefined) updateData.currentPeriodStart = body.currentPeriodStart ?? null;
    if (body.currentPeriodEnd !== undefined) updateData.currentPeriodEnd = body.currentPeriodEnd ?? null;
    if (body.amount !== undefined) updateData.amount = body.amount != null ? String(body.amount) : null;
    if (body.paymentStatus !== undefined) {
      updateData.paymentStatus = body.paymentStatus;
      if (body.paymentStatus === "paid") updateData.paidAt = new Date();
    }
    if (body.paidAt !== undefined) updateData.paidAt = body.paidAt ? new Date(body.paidAt) : null;
    if (body.notes !== undefined) updateData.notes = body.notes ?? null;

    const [sub] = await db
      .update(clinicSubscriptionsTable)
      .set(updateData)
      .where(eq(clinicSubscriptionsTable.id, id))
      .returning();

    if (!sub) {
      res.status(404).json({ error: "Not Found", message: "Assinatura não encontrada" });
      return;
    }
    res.json(sub);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Current clinic subscription (any authenticated user) ─────────────────────

router.get("/clinic-subscriptions/mine", async (req: AuthRequest, res) => {
  try {
    const clinicId = req.clinicId;
    if (!clinicId) {
      res.json(null);
      return;
    }

    const [row] = await db
      .select({
        sub: clinicSubscriptionsTable,
        plan: subscriptionPlansTable,
      })
      .from(clinicSubscriptionsTable)
      .leftJoin(subscriptionPlansTable, eq(clinicSubscriptionsTable.planId, subscriptionPlansTable.id))
      .where(eq(clinicSubscriptionsTable.clinicId, clinicId))
      .limit(1);

    res.json(row ?? null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
