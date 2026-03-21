import { Router } from "express";
import { db } from "@workspace/db";
import { financialRecordsTable, appointmentsTable, proceduresTable } from "@workspace/db";
import { eq, and, sql, gte, lte, lt } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

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

router.get("/dashboard", requirePermission("financial.read"), async (req, res) => {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const { start, end } = monthRange(year, month);
    const { startDate, endDate } = monthDateRange(year, month);

    const records = await db
      .select()
      .from(financialRecordsTable)
      .where(and(gte(financialRecordsTable.createdAt, start), lt(financialRecordsTable.createdAt, end)));

    const monthlyRevenue = records
      .filter((r) => r.type === "receita")
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const monthlyExpenses = records
      .filter((r) => r.type === "despesa")
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const completedAppts = await db
      .select({ count: sql<number>`count(*)` })
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.status, "concluido"),
          gte(appointmentsTable.date, startDate),
          lte(appointmentsTable.date, endDate)
        )
      );

    const totalAppts = await db
      .select({ count: sql<number>`count(*)` })
      .from(appointmentsTable)
      .where(and(gte(appointmentsTable.date, startDate), lte(appointmentsTable.date, endDate)));

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
        and(
          eq(financialRecordsTable.type, "receita"),
          gte(financialRecordsTable.createdAt, start),
          lt(financialRecordsTable.createdAt, end)
        )
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
        and(
          eq(financialRecordsTable.type, "receita"),
          gte(financialRecordsTable.createdAt, start),
          lt(financialRecordsTable.createdAt, end)
        )
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

router.get("/records", requirePermission("financial.read"), async (req, res) => {
  try {
    const type = req.query.type as string | undefined;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    const conditions: ReturnType<typeof eq>[] = [];

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

router.post("/records", requirePermission("financial.write"), async (req, res) => {
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

export default router;
