import { Router } from "express";
import { db } from "@workspace/db";
import { financialRecordsTable, appointmentsTable, proceduresTable, patientSubscriptionsTable, sessionCreditsTable, patientsTable } from "@workspace/db";
import { eq, and, sql, gte, lte, lt, gt, inArray } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { logAudit } from "../lib/auditLog.js";

function clinicCond(req: AuthRequest) {
  if (req.isSuperAdmin || !req.clinicId) return null;
  return eq(financialRecordsTable.clinicId, req.clinicId);
}

function apptClinicCond(req: AuthRequest) {
  if (req.isSuperAdmin || !req.clinicId) return null;
  return eq(appointmentsTable.clinicId, req.clinicId);
}

const router = Router();
router.use(authMiddleware);

function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

function monthDateRange(year: number, month: number): { startDate: string; endDate: string } {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

router.get("/dashboard", requirePermission("financial.read"), async (req: AuthRequest, res) => {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const { start, end } = monthRange(year, month);
    const { startDate, endDate } = monthDateRange(year, month);

    const cc = clinicCond(req);
    const ac = apptClinicCond(req);

    const records = await db
      .select()
      .from(financialRecordsTable)
      .where(
        cc
          ? and(cc, gte(financialRecordsTable.createdAt, start), lt(financialRecordsTable.createdAt, end))
          : and(gte(financialRecordsTable.createdAt, start), lt(financialRecordsTable.createdAt, end))
      );

    // Revenue: use paymentDate when available for paid records; fall back to createdAt for others
    const monthlyRevenue = records
      .filter((r) => {
        if (r.type !== "receita" || r.transactionType !== "pagamento" || r.status !== "pago") return false;
        if (r.paymentDate) {
          return r.paymentDate >= startDate && r.paymentDate <= endDate;
        }
        return r.createdAt >= start && r.createdAt < end;
      })
      .reduce((sum, r) => sum + Number(r.amount), 0);

    // Expenses: use createdAt (no paymentDate concept for expenses)
    const monthlyExpenses = records
      .filter((r) => r.type === "despesa")
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const completedAppts = await db
      .select({ count: sql<number>`count(*)` })
      .from(appointmentsTable)
      .where(
        ac
          ? and(ac, eq(appointmentsTable.status, "concluido"), gte(appointmentsTable.date, startDate), lte(appointmentsTable.date, endDate))
          : and(eq(appointmentsTable.status, "concluido"), gte(appointmentsTable.date, startDate), lte(appointmentsTable.date, endDate))
      );

    const totalAppts = await db
      .select({ count: sql<number>`count(*)` })
      .from(appointmentsTable)
      .where(
        ac
          ? and(ac, gte(appointmentsTable.date, startDate), lte(appointmentsTable.date, endDate))
          : and(gte(appointmentsTable.date, startDate), lte(appointmentsTable.date, endDate))
      );

    const completedCount = Number(completedAppts[0]?.count ?? 0);
    const averageTicket = completedCount > 0 ? monthlyRevenue / completedCount : 0;

    const categoryRevenue = await db
      .select({
        category: proceduresTable.category,
        revenue: sql<number>`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0)`,
      })
      .from(financialRecordsTable)
      .leftJoin(appointmentsTable, eq(financialRecordsTable.appointmentId, appointmentsTable.id))
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
      .where(
        cc
          ? and(cc, eq(financialRecordsTable.type, "receita"), eq(financialRecordsTable.transactionType, "pagamento"), gte(financialRecordsTable.createdAt, start), lt(financialRecordsTable.createdAt, end))
          : and(eq(financialRecordsTable.type, "receita"), eq(financialRecordsTable.transactionType, "pagamento"), gte(financialRecordsTable.createdAt, start), lt(financialRecordsTable.createdAt, end))
      )
      .groupBy(proceduresTable.category);

    const topProc = await db
      .select({
        name: proceduresTable.name,
        total: sql<number>`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0)`,
      })
      .from(financialRecordsTable)
      .leftJoin(appointmentsTable, eq(financialRecordsTable.appointmentId, appointmentsTable.id))
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
      .where(
        cc
          ? and(cc, eq(financialRecordsTable.type, "receita"), eq(financialRecordsTable.transactionType, "pagamento"), gte(financialRecordsTable.createdAt, start), lt(financialRecordsTable.createdAt, end))
          : and(eq(financialRecordsTable.type, "receita"), eq(financialRecordsTable.transactionType, "pagamento"), gte(financialRecordsTable.createdAt, start), lt(financialRecordsTable.createdAt, end))
      )
      .groupBy(proceduresTable.name)
      .orderBy(sql`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0) DESC`)
      .limit(1);

    res.json({
      monthlyRevenue,
      monthlyExpenses,
      monthlyProfit: monthlyRevenue - monthlyExpenses,
      averageTicket,
      totalAppointments: Number(totalAppts[0]?.count ?? 0),
      completedAppointments: completedCount,
      topProcedure: topProc[0]?.name ?? null,
      revenueByCategory: categoryRevenue.map((c) => ({
        category: c.category ?? "outros",
        revenue: Number(c.revenue),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/records", requirePermission("financial.read"), async (req: AuthRequest, res) => {
  try {
    const type = req.query.type as string | undefined;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    const conditions: any[] = [];

    const cc = clinicCond(req);
    if (cc) conditions.push(cc);
    if (type) conditions.push(eq(financialRecordsTable.type, type));
    if (month && year) {
      const { start, end } = monthRange(year, month);
      conditions.push(gte(financialRecordsTable.createdAt, start));
      conditions.push(lt(financialRecordsTable.createdAt, end));
    }

    const records = await db
      .select({
        id: financialRecordsTable.id,
        type: financialRecordsTable.type,
        amount: financialRecordsTable.amount,
        description: financialRecordsTable.description,
        category: financialRecordsTable.category,
        appointmentId: financialRecordsTable.appointmentId,
        patientId: financialRecordsTable.patientId,
        procedureId: financialRecordsTable.procedureId,
        transactionType: financialRecordsTable.transactionType,
        status: financialRecordsTable.status,
        procedureName: proceduresTable.name,
        createdAt: financialRecordsTable.createdAt,
      })
      .from(financialRecordsTable)
      .leftJoin(proceduresTable, eq(financialRecordsTable.procedureId, proceduresTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(financialRecordsTable.createdAt);

    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/records", requirePermission("financial.write"), async (req: AuthRequest, res) => {
  try {
    const { type = "despesa", amount, description, category, patientId, procedureId } = req.body;

    if (!amount || !description) {
      res.status(400).json({ error: "Bad Request", message: "Valor e descrição são obrigatórios" });
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: "Bad Request", message: "Valor deve ser maior que zero" });
      return;
    }

    const [record] = await db
      .insert(financialRecordsTable)
      .values({
        type,
        amount: String(numAmount),
        description,
        category: category || null,
        patientId: patientId ? parseInt(String(patientId)) : null,
        procedureId: procedureId ? parseInt(String(procedureId)) : null,
        clinicId: req.clinicId ?? null,
      })
      .returning();

    const result = { ...record, procedureName: null as string | null };

    if (record.procedureId) {
      const [proc] = await db
        .select({ name: proceduresTable.name })
        .from(proceduresTable)
        .where(eq(proceduresTable.id, record.procedureId));
      result.procedureName = proc?.name ?? null;
    }

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/patients/:patientId/history", requirePermission("financial.read"), async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId as string);

    const records = await db
      .select({
        id: financialRecordsTable.id,
        type: financialRecordsTable.type,
        amount: financialRecordsTable.amount,
        description: financialRecordsTable.description,
        category: financialRecordsTable.category,
        transactionType: financialRecordsTable.transactionType,
        status: financialRecordsTable.status,
        dueDate: financialRecordsTable.dueDate,
        paymentDate: financialRecordsTable.paymentDate,
        paymentMethod: financialRecordsTable.paymentMethod,
        appointmentId: financialRecordsTable.appointmentId,
        procedureId: financialRecordsTable.procedureId,
        subscriptionId: financialRecordsTable.subscriptionId,
        procedureName: proceduresTable.name,
        createdAt: financialRecordsTable.createdAt,
      })
      .from(financialRecordsTable)
      .leftJoin(proceduresTable, eq(financialRecordsTable.procedureId, proceduresTable.id))
      .where(eq(financialRecordsTable.patientId, patientId))
      .orderBy(financialRecordsTable.createdAt);

    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/patients/:patientId/summary", requirePermission("financial.read"), async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId as string);

    const records = await db
      .select()
      .from(financialRecordsTable)
      .where(eq(financialRecordsTable.patientId, patientId));

    const RECEIVABLE_TYPES = ["creditoAReceber", "cobrancaSessao", "cobrancaMensal"];

    const totalAReceber = records
      .filter((r) => RECEIVABLE_TYPES.includes(r.transactionType ?? "") && r.status !== "cancelado" && r.status !== "estornado" && Number(r.amount) > 0)
      .reduce((s, r) => s + Number(r.amount), 0);

    const totalPago = records
      .filter((r) => r.transactionType === "pagamento" && r.status === "pago")
      .reduce((s, r) => s + Number(r.amount), 0);

    const saldo = totalAReceber - totalPago;

    const credits = await db
      .select()
      .from(sessionCreditsTable)
      .where(eq(sessionCreditsTable.patientId, patientId));

    const totalSessionCredits = credits.reduce((s, c) => s + (c.quantity - c.usedQuantity), 0);

    res.json({
      totalAReceber,
      totalPago,
      saldo,
      totalSessionCredits,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/patients/:patientId/payment", requirePermission("financial.write"), async (req: AuthRequest, res) => {
  try {
    const patientId = parseInt(req.params.patientId as string);
    const { amount, paymentMethod, description, procedureId } = req.body;

    if (!amount) {
      res.status(400).json({ error: "Bad Request", message: "Valor é obrigatório" });
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: "Bad Request", message: "Valor deve ser maior que zero" });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const [patient] = await db.select({ name: patientsTable.name }).from(patientsTable).where(eq(patientsTable.id, patientId));

    const [record] = await db
      .insert(financialRecordsTable)
      .values({
        type: "receita",
        amount: String(numAmount),
        description: description || `Pagamento — ${patient?.name ?? "Paciente"}`,
        category: "Pagamento",
        patientId,
        procedureId: procedureId ? parseInt(String(procedureId)) : null,
        transactionType: "pagamento",
        status: "pago",
        paymentDate: today,
        paymentMethod: paymentMethod || null,
        clinicId: req.clinicId ?? null,
      })
      .returning();

    await logAudit({
      userId: req.userId,
      action: "create",
      entityType: "financial_record",
      entityId: record.id,
      patientId,
      summary: `Pagamento registrado: R$ ${numAmount.toFixed(2)} — ${paymentMethod ?? ""}`,
    });

    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/patients/:patientId/credits", requirePermission("financial.read"), async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId as string);

    const credits = await db
      .select({
        credit: sessionCreditsTable,
        procedure: proceduresTable,
      })
      .from(sessionCreditsTable)
      .leftJoin(proceduresTable, eq(sessionCreditsTable.procedureId, proceduresTable.id))
      .where(eq(sessionCreditsTable.patientId, patientId));

    const withBalance = credits.map(({ credit, procedure }) => ({
      ...credit,
      procedure,
      availableCount: credit.quantity - credit.usedQuantity,
    }));

    const totalAvailable = withBalance.reduce((s, c) => s + c.availableCount, 0);
    res.json({ credits: withBalance, totalAvailable });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/patients/:patientId/subscriptions", requirePermission("financial.read"), async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId as string);

    const subs = await db
      .select({
        subscription: patientSubscriptionsTable,
        procedure: proceduresTable,
      })
      .from(patientSubscriptionsTable)
      .leftJoin(proceduresTable, eq(patientSubscriptionsTable.procedureId, proceduresTable.id))
      .where(eq(patientSubscriptionsTable.patientId, patientId))
      .orderBy(patientSubscriptionsTable.createdAt);

    res.json(subs.map(({ subscription, procedure }) => ({ ...subscription, procedure })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/records/:id/status", requirePermission("financial.write"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { status, paymentDate, paymentMethod } = req.body;

    if (!status) {
      res.status(400).json({ error: "Bad Request", message: "status é obrigatório" });
      return;
    }

    const [record] = await db
      .update(financialRecordsTable)
      .set({
        status,
        paymentDate: paymentDate || undefined,
        paymentMethod: paymentMethod || undefined,
      })
      .where(eq(financialRecordsTable.id, id))
      .returning();

    if (!record) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/records/:id/estorno", requirePermission("financial.write"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);

    const [record] = await db
      .select()
      .from(financialRecordsTable)
      .where(eq(financialRecordsTable.id, id));

    if (!record) {
      res.status(404).json({ error: "Not Found", message: "Registro financeiro não encontrado" });
      return;
    }

    if (record.status === "estornado") {
      res.status(400).json({ error: "Bad Request", message: "Registro já foi estornado" });
      return;
    }

    const [updated] = await db
      .update(financialRecordsTable)
      .set({ status: "estornado" })
      .where(eq(financialRecordsTable.id, id))
      .returning();

    await logAudit({
      userId: req.userId,
      action: "update",
      entityType: "financial_record",
      entityId: id,
      patientId: record.patientId ?? null,
      summary: `Estorno aplicado: ${record.description} (R$ ${Number(record.amount).toFixed(2)})`,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/records/:id", requirePermission("financial.write"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);

    const [record] = await db
      .select()
      .from(financialRecordsTable)
      .where(eq(financialRecordsTable.id, id));

    if (!record) {
      res.status(404).json({ error: "Not Found", message: "Registro financeiro não encontrado" });
      return;
    }

    if (record.type === "despesa") {
      await db.delete(financialRecordsTable).where(eq(financialRecordsTable.id, id));
    } else {
      await db
        .update(financialRecordsTable)
        .set({ status: "estornado" })
        .where(eq(financialRecordsTable.id, id));
    }

    await logAudit({
      userId: req.userId,
      action: "delete",
      entityType: "financial_record",
      entityId: id,
      patientId: record.patientId ?? null,
      summary: `Registro financeiro estornado/removido: ${record.description} (R$ ${Number(record.amount).toFixed(2)})`,
    });

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
