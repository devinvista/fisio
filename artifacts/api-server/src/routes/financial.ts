import { Router } from "express";
import { db } from "@workspace/db";
import { financialRecordsTable, appointmentsTable, proceduresTable, patientSubscriptionsTable, sessionCreditsTable, patientsTable, procedureCostsTable, schedulesTable, recurringExpensesTable } from "@workspace/db";
import { eq, and, sql, gte, lte, lt, gt, inArray, isNotNull, isNull, or, count } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { logAudit } from "../lib/auditLog.js";
import { nowBRT, todayBRT } from "../lib/dateUtils.js";
import { validateBody, positiveNumber } from "../lib/validate.js";
import { z } from "zod/v4";

const createRecordSchema = z.object({
  type: z.enum(["receita", "despesa"]).default("despesa"),
  amount: positiveNumber,
  description: z.string().min(1, "Descrição é obrigatória").max(500),
  category: z.string().max(100).optional().nullable(),
  patientId: z.number().int().positive().optional().nullable(),
  procedureId: z.number().int().positive().optional().nullable(),
});

const createPaymentSchema = z.object({
  amount: positiveNumber,
  paymentMethod: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  procedureId: z.number().int().positive().optional().nullable(),
});

const updateRecordStatusSchema = z.object({
  status: z.enum(["pendente", "pago", "cancelado", "estornado"], { error: "Status inválido" }),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "paymentDate deve estar no formato YYYY-MM-DD").optional().nullable(),
  paymentMethod: z.string().max(50).optional().nullable(),
});

function clinicCond(req: AuthRequest) {
  if (req.isSuperAdmin || !req.clinicId) return null;
  return eq(financialRecordsTable.clinicId, req.clinicId);
}

function apptClinicCond(req: AuthRequest) {
  if (req.isSuperAdmin || !req.clinicId) return null;
  return eq(appointmentsTable.clinicId, req.clinicId);
}

async function assertPatientInClinic(patientId: number, req: AuthRequest): Promise<boolean> {
  if (req.isSuperAdmin || !req.clinicId) return true;
  const [p] = await db
    .select({ id: patientsTable.id })
    .from(patientsTable)
    .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, req.clinicId)));
  return !!p;
}

const router = Router();
router.use(authMiddleware);

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
    const brt = nowBRT();
    const month = parseInt(req.query.month as string) || brt.month;
    const year = parseInt(req.query.year as string) || brt.year;

    const { startDate, endDate } = monthDateRange(year, month);

    const cc = clinicCond(req);
    const ac = apptClinicCond(req);

    // Use paymentDate as the primary date filter (covers both revenue and expenses)
    const records = await db
      .select()
      .from(financialRecordsTable)
      .where(
        cc
          ? and(cc, gte(financialRecordsTable.paymentDate, startDate), lte(financialRecordsTable.paymentDate, endDate))
          : and(gte(financialRecordsTable.paymentDate, startDate), lte(financialRecordsTable.paymentDate, endDate))
      );

    const monthlyRevenue = records
      .filter((r) => r.type === "receita" && r.status !== "estornado" && r.status !== "cancelado")
      .reduce((sum, r) => sum + Number(r.amount), 0);

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
          ? and(cc, eq(financialRecordsTable.type, "receita"), gte(financialRecordsTable.paymentDate, startDate), lte(financialRecordsTable.paymentDate, endDate))
          : and(eq(financialRecordsTable.type, "receita"), gte(financialRecordsTable.paymentDate, startDate), lte(financialRecordsTable.paymentDate, endDate))
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
          ? and(cc, eq(financialRecordsTable.type, "receita"), gte(financialRecordsTable.paymentDate, startDate), lte(financialRecordsTable.paymentDate, endDate))
          : and(eq(financialRecordsTable.type, "receita"), gte(financialRecordsTable.paymentDate, startDate), lte(financialRecordsTable.paymentDate, endDate))
      )
      .groupBy(proceduresTable.name)
      .orderBy(sql`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0) DESC`)
      .limit(1);

    // MRR — soma das mensalidades de assinaturas ativas para esta clínica
    const subClinicCond = req.isSuperAdmin || !req.clinicId
      ? eq(patientSubscriptionsTable.status, "ativa")
      : and(eq(patientSubscriptionsTable.status, "ativa"), eq(patientSubscriptionsTable.clinicId, req.clinicId!));

    const mrrResult = await db
      .select({ mrr: sql<number>`COALESCE(SUM(${patientSubscriptionsTable.monthlyAmount}::numeric), 0)` })
      .from(patientSubscriptionsTable)
      .where(subClinicCond);

    const mrr = Number(mrrResult[0]?.mrr ?? 0);

    const activeSubsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(patientSubscriptionsTable)
      .where(subClinicCond);

    // Cobranças de assinaturas pendentes (geradas pelo billing, ainda não pagas)
    const pendingSubsWhere = cc
      ? and(cc, eq(financialRecordsTable.status, "pendente"), isNotNull(financialRecordsTable.subscriptionId))
      : and(eq(financialRecordsTable.status, "pendente"), isNotNull(financialRecordsTable.subscriptionId));

    const pendingSubRecords = await db
      .select({
        count: sql<number>`count(*)`,
        total: sql<number>`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0)`,
      })
      .from(financialRecordsTable)
      .where(pendingSubsWhere);

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
      mrr,
      activeSubscriptions: Number(activeSubsCount[0]?.count ?? 0),
      pendingSubscriptionCharges: {
        count: Number(pendingSubRecords[0]?.count ?? 0),
        total: Number(pendingSubRecords[0]?.total ?? 0),
      },
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
      const { startDate, endDate } = monthDateRange(year, month);
      conditions.push(
        or(
          and(gte(financialRecordsTable.paymentDate, startDate), lte(financialRecordsTable.paymentDate, endDate)),
          and(isNull(financialRecordsTable.paymentDate), gte(financialRecordsTable.dueDate, startDate), lte(financialRecordsTable.dueDate, endDate))
        )!
      );
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
        paymentDate: financialRecordsTable.paymentDate,
        dueDate: financialRecordsTable.dueDate,
        paymentMethod: financialRecordsTable.paymentMethod,
        subscriptionId: financialRecordsTable.subscriptionId,
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
    const body = validateBody(createRecordSchema, req.body, res);
    if (!body) return;
    const { type, amount, description, category, patientId, procedureId } = body;

    const [record] = await db
      .insert(financialRecordsTable)
      .values({
        type,
        amount: String(amount),
        description,
        category: category ?? null,
        patientId: patientId ?? null,
        procedureId: procedureId ?? null,
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
    if (!await assertPatientInClinic(patientId, req as AuthRequest)) {
      res.status(403).json({ error: "Forbidden", message: "Acesso negado a este paciente" });
      return;
    }

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
    if (!await assertPatientInClinic(patientId, req as AuthRequest)) {
      res.status(403).json({ error: "Forbidden", message: "Acesso negado a este paciente" });
      return;
    }

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
    if (!await assertPatientInClinic(patientId, req)) {
      res.status(403).json({ error: "Forbidden", message: "Acesso negado a este paciente" });
      return;
    }
    const body = validateBody(createPaymentSchema, req.body, res);
    if (!body) return;
    const { amount, paymentMethod, description, procedureId } = body;
    const numAmount = Number(amount);

    const today = todayBRT();

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
    if (!await assertPatientInClinic(patientId, req as AuthRequest)) {
      res.status(403).json({ error: "Forbidden", message: "Acesso negado a este paciente" });
      return;
    }

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
    if (!await assertPatientInClinic(patientId, req as AuthRequest)) {
      res.status(403).json({ error: "Forbidden", message: "Acesso negado a este paciente" });
      return;
    }

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

router.patch("/records/:id/status", requirePermission("financial.write"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const body = validateBody(updateRecordStatusSchema, req.body, res);
    if (!body) return;
    const { status, paymentDate, paymentMethod } = body;

    // Busca o registro antes de atualizar para checar transição de status
    const cc = clinicCond(req);
    const existingWhere = cc ? and(eq(financialRecordsTable.id, id), cc) : eq(financialRecordsTable.id, id);

    const [existing] = await db
      .select()
      .from(financialRecordsTable)
      .where(existingWhere);

    if (!existing) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const [record] = await db
      .update(financialRecordsTable)
      .set({
        status,
        paymentDate: paymentDate || undefined,
        paymentMethod: paymentMethod || undefined,
      })
      .where(existingWhere)
      .returning();

    if (!record) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    // Gera session_credit automaticamente quando cobrança de assinatura é paga
    if (
      status === "pago" &&
      existing.status !== "pago" &&
      existing.subscriptionId != null
    ) {
      try {
        const [sub] = await db
          .select()
          .from(patientSubscriptionsTable)
          .where(eq(patientSubscriptionsTable.id, existing.subscriptionId));

        if (sub) {
          await db.insert(sessionCreditsTable).values({
            patientId: sub.patientId,
            procedureId: sub.procedureId,
            quantity: 1,
            usedQuantity: 0,
            clinicId: sub.clinicId ?? req.clinicId ?? null,
            notes: `Crédito gerado automaticamente — mensalidade #${record.id} paga`,
          });
          console.log(
            `[session-credit] Crédito gerado para paciente #${sub.patientId} / procedimento #${sub.procedureId} — registro financeiro #${record.id}`
          );
        }
      } catch (creditErr) {
        console.error("[session-credit] Erro ao gerar crédito de sessão:", creditErr);
      }
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

// ─── GET /cost-per-procedure ───────────────────────────────────────────────────
// Returns all active procedures with estimated cost, real (overhead-rateado) cost per session,
// revenue generated in the month, and margin analysis.
router.get("/cost-per-procedure", requirePermission("financial.read"), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.clinicId;
    if (!clinicId && !req.isSuperAdmin) {
      res.status(400).json({ error: "Bad Request", message: "Clínica não identificada" });
      return;
    }

    const brt = nowBRT();
    const month = parseInt(req.query.month as string) || brt.month;
    const year  = parseInt(req.query.year  as string) || brt.year;

    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate   = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate     = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    // ── 1. Total real overhead expenses (accrual: by dueDate) ─────────────────
    // Using dueDate for consistency with the overhead-analysis endpoint.
    const expCond = clinicId
      ? and(eq(financialRecordsTable.clinicId, clinicId), eq(financialRecordsTable.type, "despesa"), gte(financialRecordsTable.dueDate, startDate), lte(financialRecordsTable.dueDate, endDate))
      : and(eq(financialRecordsTable.type, "despesa"), gte(financialRecordsTable.dueDate, startDate), lte(financialRecordsTable.dueDate, endDate));

    const [expRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0)` })
      .from(financialRecordsTable)
      .where(expCond);
    const totalRealOverhead = Number(expRow?.total ?? 0);

    // ── 2. Estimated overhead from recurring expenses ─────────────────────────
    // Weekly expenses use actual week count for the month (daysInMonth / 7)
    // instead of the fixed 4.33 approximation.
    const weeksInMonth = daysInMonth / 7;

    const recCond = clinicId
      ? and(eq(recurringExpensesTable.clinicId, clinicId), eq(recurringExpensesTable.isActive, true))
      : eq(recurringExpensesTable.isActive, true);

    const recurringRows = await db.select().from(recurringExpensesTable).where(recCond);
    const totalEstimatedOverhead = recurringRows.reduce((sum, r) => {
      const amt = Number(r.amount);
      if (r.frequency === "anual") return sum + amt / 12;
      if (r.frequency === "semanal") return sum + amt * weeksInMonth;
      return sum + amt; // mensal
    }, 0);

    // ── 3. Available clinic hours ──────────────────────────────────────────────
    const schCond = clinicId
      ? and(eq(schedulesTable.clinicId, clinicId), eq(schedulesTable.isActive, true), eq(schedulesTable.type, "clinic"))
      : and(eq(schedulesTable.isActive, true), eq(schedulesTable.type, "clinic"));

    const schedules = await db.select().from(schedulesTable).where(schCond);
    let totalAvailableHours = 0;
    for (const sch of schedules) {
      const days = sch.workingDays.split(",").map(Number);
      const [sh, sm] = sch.startTime.split(":").map(Number);
      const [eh, em] = sch.endTime.split(":").map(Number);
      const hpd = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
      let wd = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        if (days.includes(new Date(year, month - 1, d).getDay())) wd++;
      }
      totalAvailableHours += hpd * wd;
    }

    const realCostPerHour  = totalAvailableHours > 0 ? totalRealOverhead  / totalAvailableHours : 0;
    const estCostPerHour   = totalAvailableHours > 0 ? totalEstimatedOverhead / totalAvailableHours : 0;

    // ── 4. Procedures with costs and appointment stats ─────────────────────────
    const procCond = clinicId
      ? and(or(isNull(proceduresTable.clinicId), eq(proceduresTable.clinicId, clinicId)), eq(proceduresTable.isActive, true))
      : eq(proceduresTable.isActive, true);

    const procs = await db
      .select({
        id: proceduresTable.id,
        name: proceduresTable.name,
        category: proceduresTable.category,
        modalidade: proceduresTable.modalidade,
        durationMinutes: proceduresTable.durationMinutes,
        maxCapacity: proceduresTable.maxCapacity,
        price: proceduresTable.price,
        baseCost: proceduresTable.cost,
        // Only variableCost is fetched from procedure_costs.
        // Overhead is always calculated dynamically to avoid double-counting.
        variableCost: procedureCostsTable.variableCost,
      })
      .from(proceduresTable)
      .leftJoin(
        procedureCostsTable,
        and(
          eq(procedureCostsTable.procedureId, proceduresTable.id),
          clinicId ? eq(procedureCostsTable.clinicId, clinicId) : sql`false`
        )
      )
      .where(procCond)
      .orderBy(proceduresTable.name);

    // Appointment counts + revenue per procedure for the month
    const apptStatsCond = clinicId
      ? and(eq(appointmentsTable.clinicId, clinicId), gte(appointmentsTable.date, startDate), lte(appointmentsTable.date, endDate))
      : and(gte(appointmentsTable.date, startDate), lte(appointmentsTable.date, endDate));

    const apptStats = await db
      .select({
        procedureId: appointmentsTable.procedureId,
        completedCount: sql<number>`COUNT(*) FILTER (WHERE ${appointmentsTable.status} IN ('concluido','compareceu'))`,
        scheduledCount: sql<number>`COUNT(*)`,
        // Unique group sessions: distinct (date, startTime) among completed appointments.
        // Used to compute the real average participants per session for group procedures.
        uniqueCompletedSessions: sql<number>`COUNT(DISTINCT CASE WHEN ${appointmentsTable.status} IN ('concluido','compareceu') THEN (${appointmentsTable.date}::text || '_' || ${appointmentsTable.startTime}) END)`,
      })
      .from(appointmentsTable)
      .where(apptStatsCond)
      .groupBy(appointmentsTable.procedureId);

    const apptMap = new Map(apptStats.map(a => [a.procedureId, a]));

    // Revenue per procedure
    const revStatsCond = clinicId
      ? and(eq(financialRecordsTable.clinicId, clinicId), eq(financialRecordsTable.type, "receita"), gte(financialRecordsTable.paymentDate, startDate), lte(financialRecordsTable.paymentDate, endDate))
      : and(eq(financialRecordsTable.type, "receita"), gte(financialRecordsTable.paymentDate, startDate), lte(financialRecordsTable.paymentDate, endDate));

    const revByProcedure = await db
      .select({
        procedureId: appointmentsTable.procedureId,
        totalRevenue: sql<number>`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0)`,
      })
      .from(financialRecordsTable)
      .leftJoin(appointmentsTable, eq(financialRecordsTable.appointmentId, appointmentsTable.id))
      .where(revStatsCond)
      .groupBy(appointmentsTable.procedureId);

    const revMap = new Map(revByProcedure.map(r => [r.procedureId, r.totalRevenue]));

    const results = procs.map((p) => {
      const durationHours = p.durationMinutes / 60;
      const isGroup = p.modalidade !== "individual";
      const maxCap = Math.max(p.maxCapacity ?? 1, 1);

      const stats = apptMap.get(p.id);
      const completedParticipants  = Number(stats?.completedCount ?? 0);
      const scheduledSessions      = Number(stats?.scheduledCount ?? 0);
      const uniqueCompletedSessions = Number(stats?.uniqueCompletedSessions ?? 0);

      // Estimated divisor: assume session runs at full capacity (used for pricing).
      const estimatedCapacityDivisor = isGroup ? maxCap : 1;

      // Real divisor: actual average participants per session in the period.
      // Falls back to maxCapacity when there are no completed sessions yet.
      const avgActualParticipants = (isGroup && uniqueCompletedSessions > 0)
        ? completedParticipants / uniqueCompletedSessions
        : estimatedCapacityDivisor;
      const realCapacityDivisor = Math.max(avgActualParticipants, 1);

      // Direct material/variable cost only — overhead is always added dynamically.
      // When procedure_costs has been configured, use its variableCost.
      // Otherwise fall back to the base cost stored on the procedure.
      const hasClinicCost = p.variableCost !== null;
      const variableDirectCost = hasClinicCost
        ? Number(p.variableCost ?? 0)
        : Number(p.baseCost ?? 0);

      // Overhead per participant:
      //   estimated → maxCapacity (full session assumption)
      //   real      → actual avg participants (reflects real occupancy)
      const realOverheadCostPerSession      = (realCostPerHour  * durationHours) / realCapacityDivisor;
      const estimatedOverheadCostPerSession = (estCostPerHour   * durationHours) / estimatedCapacityDivisor;

      const estimatedTotalCostPerSession = variableDirectCost + estimatedOverheadCostPerSession;
      const realTotalCostPerSession      = variableDirectCost + realOverheadCostPerSession;

      const price = Number(p.price);
      const revenueGenerated = Number(revMap.get(p.id) ?? 0);

      return {
        procedureId: p.id,
        name: p.name,
        category: p.category,
        modalidade: p.modalidade,
        durationMinutes: p.durationMinutes,
        maxCapacity: maxCap,
        estimatedCapacityDivisor,
        realCapacityDivisor: Math.round(realCapacityDivisor * 100) / 100,
        avgActualParticipants: isGroup ? Math.round(avgActualParticipants * 10) / 10 : null,
        price,
        variableDirectCost: Math.round(variableDirectCost * 100) / 100,
        estimatedOverheadPerSession: Math.round(estimatedOverheadCostPerSession * 100) / 100,
        estimatedTotalCostPerSession: Math.round(estimatedTotalCostPerSession * 100) / 100,
        realOverheadPerSession: Math.round(realOverheadCostPerSession * 100) / 100,
        realTotalCostPerSession: Math.round(realTotalCostPerSession * 100) / 100,
        estimatedMarginPerSession: Math.round((price - estimatedTotalCostPerSession) * 100) / 100,
        realMarginPerSession: Math.round((price - realTotalCostPerSession) * 100) / 100,
        estimatedMarginPct: price > 0 ? Math.round(((price - estimatedTotalCostPerSession) / price) * 10000) / 100 : 0,
        realMarginPct: price > 0 ? Math.round(((price - realTotalCostPerSession) / price) * 10000) / 100 : 0,
        completedParticipants,
        uniqueCompletedSessions,
        scheduledSessions,
        revenueGenerated: Math.round(revenueGenerated * 100) / 100,
        realCostAllocated: Math.round(completedParticipants * realTotalCostPerSession * 100) / 100,
        estimatedCostAllocated: Math.round(completedParticipants * estimatedTotalCostPerSession * 100) / 100,
      };
    });

    res.json({
      month, year,
      totalRealOverhead: Math.round(totalRealOverhead * 100) / 100,
      totalEstimatedOverhead: Math.round(totalEstimatedOverhead * 100) / 100,
      totalAvailableHours: Math.round(totalAvailableHours * 10) / 10,
      realCostPerHour:  Math.round(realCostPerHour * 100) / 100,
      estCostPerHour:   Math.round(estCostPerHour * 100) / 100,
      procedures: results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /dre ─────────────────────────────────────────────────────────────────
// Mini Demonstrativo de Resultado do Exercício (DRE) mensal
router.get("/dre", requirePermission("financial.read"), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.clinicId;
    const brt = nowBRT();
    const month = parseInt(req.query.month as string) || brt.month;
    const year  = parseInt(req.query.year  as string) || brt.year;

    function dateRange(y: number, m: number) {
      const last = new Date(y, m, 0).getDate();
      const mm = String(m).padStart(2, "0");
      return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
    }

    const { start, end } = dateRange(year, month);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const { start: ps, end: pe } = dateRange(prevYear, prevMonth);

    const cc = clinicId ? eq(financialRecordsTable.clinicId, clinicId) : null;

    async function getMonthlyFinancials(s: string, e: string) {
      const records = await db
        .select()
        .from(financialRecordsTable)
        .where(
          cc
            ? and(cc, gte(financialRecordsTable.paymentDate, s), lte(financialRecordsTable.paymentDate, e))
            : and(gte(financialRecordsTable.paymentDate, s), lte(financialRecordsTable.paymentDate, e))
        );

      const revenue = records
        .filter(r => r.type === "receita" && r.status !== "estornado" && r.status !== "cancelado")
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const expensesByCategory: Record<string, number> = {};
      const expenses = records.filter(r => r.type === "despesa");
      expenses.forEach(r => {
        const cat = r.category ?? "Outros";
        expensesByCategory[cat] = (expensesByCategory[cat] ?? 0) + Number(r.amount);
      });
      const totalExpenses = expenses.reduce((sum, r) => sum + Number(r.amount), 0);

      return { revenue, totalExpenses, expensesByCategory };
    }

    const [current, previous] = await Promise.all([
      getMonthlyFinancials(start, end),
      getMonthlyFinancials(ps, pe),
    ]);

    // Estimated revenue = MRR + pending from scheduled appointments
    const subCond = clinicId
      ? and(eq(patientSubscriptionsTable.clinicId, clinicId), eq(patientSubscriptionsTable.status, "ativa"))
      : eq(patientSubscriptionsTable.status, "ativa");

    const [mrrRow] = await db
      .select({ mrr: sql<number>`COALESCE(SUM(${patientSubscriptionsTable.monthlyAmount}::numeric), 0)` })
      .from(patientSubscriptionsTable)
      .where(subCond);

    const mrr = Number(mrrRow?.mrr ?? 0);

    // Estimated expenses from recurring expenses
    const recCond = clinicId
      ? and(eq(recurringExpensesTable.clinicId, clinicId), eq(recurringExpensesTable.isActive, true))
      : eq(recurringExpensesTable.isActive, true);

    const recurringRows = await db.select().from(recurringExpensesTable).where(recCond);
    const estimatedExpenses = recurringRows.reduce((sum, r) => {
      const amt = Number(r.amount);
      if (r.frequency === "anual") return sum + amt / 12;
      if (r.frequency === "semanal") return sum + amt * 4.33;
      return sum + amt;
    }, 0);

    // Pending receivables for the month
    const pendCond = cc
      ? and(cc, eq(financialRecordsTable.status, "pendente"), eq(financialRecordsTable.type, "receita"), gte(financialRecordsTable.dueDate, start), lte(financialRecordsTable.dueDate, end))
      : and(eq(financialRecordsTable.status, "pendente"), eq(financialRecordsTable.type, "receita"), gte(financialRecordsTable.dueDate, start), lte(financialRecordsTable.dueDate, end));

    const [pendRow] = await db
      .select({ total: sql<number>`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0)`, cnt: count() })
      .from(financialRecordsTable)
      .where(pendCond);

    const pendingReceivable = Number(pendRow?.total ?? 0);
    const estimatedRevenue  = mrr > 0 ? mrr + pendingReceivable : current.revenue + pendingReceivable;

    const netProfit   = current.revenue - current.totalExpenses;
    const prevNetProfit = previous.revenue - previous.totalExpenses;
    const netProfitChange = prevNetProfit !== 0 ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100 : 0;

    const expenseItems = Object.entries(current.expensesByCategory).map(([cat, val]) => ({
      category: cat,
      amount: Math.round(val * 100) / 100,
      pct: current.totalExpenses > 0 ? Math.round((val / current.totalExpenses) * 10000) / 100 : 0,
    })).sort((a, b) => b.amount - a.amount);

    res.json({
      month, year,
      current: {
        grossRevenue: Math.round(current.revenue * 100) / 100,
        totalExpenses: Math.round(current.totalExpenses * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        netMarginPct: current.revenue > 0 ? Math.round((netProfit / current.revenue) * 10000) / 100 : 0,
        expensesByCategory: expenseItems,
      },
      previous: {
        grossRevenue: Math.round(previous.revenue * 100) / 100,
        totalExpenses: Math.round(previous.totalExpenses * 100) / 100,
        netProfit: Math.round(prevNetProfit * 100) / 100,
        netMarginPct: previous.revenue > 0 ? Math.round((prevNetProfit / previous.revenue) * 10000) / 100 : 0,
      },
      estimated: {
        revenue: Math.round(estimatedRevenue * 100) / 100,
        expenses: Math.round(estimatedExpenses * 100) / 100,
        netProfit: Math.round((estimatedRevenue - estimatedExpenses) * 100) / 100,
        mrr: Math.round(mrr * 100) / 100,
        pendingReceivable: Math.round(pendingReceivable * 100) / 100,
      },
      variance: {
        revenue: Math.round((current.revenue - estimatedRevenue) * 100) / 100,
        revenuePct: estimatedRevenue > 0 ? Math.round(((current.revenue - estimatedRevenue) / estimatedRevenue) * 10000) / 100 : 0,
        expenses: Math.round((current.totalExpenses - estimatedExpenses) * 100) / 100,
        expensesPct: estimatedExpenses > 0 ? Math.round(((current.totalExpenses - estimatedExpenses) / estimatedExpenses) * 10000) / 100 : 0,
        netProfitChangeVsPrevMonth: Math.round(netProfitChange * 100) / 100,
      },
      recurringExpenses: recurringRows.map(r => ({
        id: r.id,
        name: r.name,
        category: r.category,
        amount: Number(r.amount),
        frequency: r.frequency,
        monthlyEquivalent: r.frequency === "anual" ? Number(r.amount) / 12 : r.frequency === "semanal" ? Number(r.amount) * 4.33 : Number(r.amount),
      })),
    });
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
