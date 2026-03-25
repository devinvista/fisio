import { Router } from "express";
import { db } from "@workspace/db";
import {
  patientSubscriptionsTable,
  financialRecordsTable,
  patientsTable,
  proceduresTable,
  sessionCreditsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();
router.use(authMiddleware);

router.get("/", requirePermission("financial.read"), async (req, res) => {
  try {
    const { patientId } = req.query;

    let query = db
      .select({
        subscription: patientSubscriptionsTable,
        patient: patientsTable,
        procedure: proceduresTable,
      })
      .from(patientSubscriptionsTable)
      .leftJoin(patientsTable, eq(patientSubscriptionsTable.patientId, patientsTable.id))
      .leftJoin(proceduresTable, eq(patientSubscriptionsTable.procedureId, proceduresTable.id));

    if (patientId) {
      query = query.where(eq(patientSubscriptionsTable.patientId, parseInt(patientId as string))) as any;
    }

    const results = await query.orderBy(patientSubscriptionsTable.createdAt);
    const subscriptions = results.map(({ subscription, patient, procedure }) => ({
      ...subscription,
      patient,
      procedure,
    }));

    res.json(subscriptions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requirePermission("financial.write"), async (req, res) => {
  try {
    const { patientId, procedureId, startDate, billingDay, monthlyAmount, notes } = req.body;

    if (!patientId || !procedureId || !startDate || !billingDay || !monthlyAmount) {
      res.status(400).json({
        error: "Bad Request",
        message: "patientId, procedureId, startDate, billingDay e monthlyAmount são obrigatórios",
      });
      return;
    }

    const day = parseInt(billingDay);
    if (day < 1 || day > 31) {
      res.status(400).json({ error: "Bad Request", message: "billingDay deve estar entre 1 e 31" });
      return;
    }

    const [subscription] = await db
      .insert(patientSubscriptionsTable)
      .values({
        patientId: parseInt(patientId),
        procedureId: parseInt(procedureId),
        startDate,
        billingDay: day,
        monthlyAmount: String(monthlyAmount),
        status: "ativa",
        notes: notes || null,
      })
      .returning();

    const result = await db
      .select({
        subscription: patientSubscriptionsTable,
        patient: patientsTable,
        procedure: proceduresTable,
      })
      .from(patientSubscriptionsTable)
      .leftJoin(patientsTable, eq(patientSubscriptionsTable.patientId, patientsTable.id))
      .leftJoin(proceduresTable, eq(patientSubscriptionsTable.procedureId, proceduresTable.id))
      .where(eq(patientSubscriptionsTable.id, subscription.id))
      .limit(1);

    const r = result[0];
    res.status(201).json(r ? { ...r.subscription, patient: r.patient, procedure: r.procedure } : subscription);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", requirePermission("financial.write"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { status, billingDay, monthlyAmount, notes } = req.body;

    const [subscription] = await db
      .update(patientSubscriptionsTable)
      .set({
        status: status || undefined,
        billingDay: billingDay ? parseInt(billingDay) : undefined,
        monthlyAmount: monthlyAmount ? String(monthlyAmount) : undefined,
        notes: notes !== undefined ? notes : undefined,
      })
      .where(eq(patientSubscriptionsTable.id, id))
      .returning();

    if (!subscription) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    res.json(subscription);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", requirePermission("financial.write"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db
      .update(patientSubscriptionsTable)
      .set({ status: "cancelada" })
      .where(eq(patientSubscriptionsTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id/credits", requirePermission("financial.read"), async (req, res) => {
  try {
    const subscriptionId = parseInt(req.params.id as string);
    const [subscription] = await db
      .select()
      .from(patientSubscriptionsTable)
      .where(eq(patientSubscriptionsTable.id, subscriptionId));

    if (!subscription) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const credits = await db
      .select()
      .from(sessionCreditsTable)
      .where(
        and(
          eq(sessionCreditsTable.patientId, subscription.patientId),
          eq(sessionCreditsTable.procedureId, subscription.procedureId)
        )
      );

    const available = credits.reduce((s, c) => s + (c.quantity - c.usedQuantity), 0);
    res.json({ credits, availableCount: available });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/run-billing", requirePermission("financial.write"), async (req, res) => {
  try {
    const today = new Date();
    const todayDay = today.getDate();
    const todayDate = today.toISOString().slice(0, 10);

    const activeSubscriptions = await db
      .select({
        subscription: patientSubscriptionsTable,
        patient: patientsTable,
        procedure: proceduresTable,
      })
      .from(patientSubscriptionsTable)
      .leftJoin(patientsTable, eq(patientSubscriptionsTable.patientId, patientsTable.id))
      .leftJoin(proceduresTable, eq(patientSubscriptionsTable.procedureId, proceduresTable.id))
      .where(eq(patientSubscriptionsTable.status, "ativa"));

    const generated: number[] = [];

    for (const row of activeSubscriptions) {
      const sub = row.subscription;
      if (sub.billingDay !== todayDay) continue;

      const existingThisMonth = await db
        .select()
        .from(financialRecordsTable)
        .where(
          and(
            eq(financialRecordsTable.subscriptionId, sub.id),
            sql`date_trunc('month', ${financialRecordsTable.dueDate}::date) = date_trunc('month', ${todayDate}::date)`
          )
        )
        .limit(1);

      if (existingThisMonth.length > 0) continue;

      const [record] = await db
        .insert(financialRecordsTable)
        .values({
          type: "receita",
          amount: sub.monthlyAmount,
          description: `Mensalidade ${row.procedure?.name ?? "Procedimento"} — ${row.patient?.name ?? "Paciente"}`,
          category: row.procedure?.category ?? null,
          patientId: sub.patientId,
          procedureId: sub.procedureId,
          transactionType: "cobranca_mensal",
          status: "pendente",
          dueDate: todayDate,
          subscriptionId: sub.id,
        })
        .returning();

      generated.push(record.id);
    }

    res.json({ generated: generated.length, recordIds: generated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
