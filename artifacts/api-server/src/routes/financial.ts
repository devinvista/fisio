import { Router } from "express";
import { db } from "@workspace/db";
import { financialRecordsTable, appointmentsTable, proceduresTable, patientSubscriptionsTable, sessionCreditsTable, patientsTable } from "@workspace/db";
import { eq, and, sql, gte, lte, lt, gt, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { logAudit } from "../lib/auditLog.js";
import { nowBRT, todayBRT } from "../lib/dateUtils.js";

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
    const { status, paymentDate, paymentMethod } = req.body;

    if (!status) {
      res.status(400).json({ error: "Bad Request", message: "status é obrigatório" });
      return;
    }

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
