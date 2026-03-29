import { Router } from "express";
import { db } from "@workspace/db";
import { financialRecordsTable, appointmentsTable, proceduresTable } from "@workspace/db";
import { and, sql, gte, lte, lt } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();
router.use(authMiddleware);

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function monthRange(year: number, month: number): { start: Date; end: Date } {
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

function monthDateRange(year: number, month: number): { startDate: string; endDate: string } {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

router.get("/monthly-revenue", requirePermission("reports.read"), async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const yearStartStr = `${year}-01-01`;
    const yearEndStr = `${year + 1}-01-01`;
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    // Revenue: use paymentDate for paid records, createdAt otherwise — consistent with financial dashboard
    const revenueRows = await db
      .select({
        month: sql<number>`
          EXTRACT(MONTH FROM
            CASE
              WHEN ${financialRecordsTable.transactionType} = 'pagamento'
               AND ${financialRecordsTable.status} = 'pago'
               AND ${financialRecordsTable.paymentDate} IS NOT NULL
              THEN TO_DATE(${financialRecordsTable.paymentDate}, 'YYYY-MM-DD')
              ELSE DATE(${financialRecordsTable.createdAt})
            END
          )::int`,
        total: sql<number>`SUM(${financialRecordsTable.amount}::numeric)`,
      })
      .from(financialRecordsTable)
      .where(
        and(
          sql`${financialRecordsTable.type} = 'receita'`,
          sql`${financialRecordsTable.status} != 'estornado'`,
          sql`
            CASE
              WHEN ${financialRecordsTable.transactionType} = 'pagamento'
               AND ${financialRecordsTable.status} = 'pago'
               AND ${financialRecordsTable.paymentDate} IS NOT NULL
              THEN ${financialRecordsTable.paymentDate} >= ${yearStartStr} AND ${financialRecordsTable.paymentDate} < ${yearEndStr}
              ELSE ${financialRecordsTable.createdAt} >= ${yearStart} AND ${financialRecordsTable.createdAt} < ${yearEnd}
            END`
        )
      )
      .groupBy(sql`1`);

    // Expenses: use createdAt
    const expenseRows = await db
      .select({
        month: sql<number>`EXTRACT(MONTH FROM ${financialRecordsTable.createdAt})::int`,
        total: sql<number>`SUM(${financialRecordsTable.amount}::numeric)`,
      })
      .from(financialRecordsTable)
      .where(
        and(
          sql`${financialRecordsTable.type} = 'despesa'`,
          gte(financialRecordsTable.createdAt, yearStart),
          lt(financialRecordsTable.createdAt, yearEnd)
        )
      )
      .groupBy(sql`EXTRACT(MONTH FROM ${financialRecordsTable.createdAt})`);

    const result = [];
    for (let month = 1; month <= 12; month++) {
      const revenue = Number(revenueRows.find((r) => r.month === month)?.total ?? 0);
      const expenses = Number(expenseRows.find((r) => r.month === month)?.total ?? 0);
      result.push({ month, monthName: MONTH_NAMES[month - 1], revenue, expenses, profit: revenue - expenses });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/procedure-revenue", requirePermission("reports.read"), async (req, res) => {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const { start, end } = monthRange(year, month);

    const results = await db
      .select({
        procedureId: proceduresTable.id,
        procedureName: proceduresTable.name,
        category: proceduresTable.category,
        totalRevenue: sql<number>`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0)`,
        totalSessions: sql<number>`COUNT(${financialRecordsTable.id})`,
      })
      .from(proceduresTable)
      .leftJoin(appointmentsTable, sql`${appointmentsTable.procedureId} = ${proceduresTable.id}`)
      .leftJoin(
        financialRecordsTable,
        and(
          sql`${financialRecordsTable.appointmentId} = ${appointmentsTable.id}`,
          sql`${financialRecordsTable.type} = 'receita'`,
          gte(financialRecordsTable.createdAt, start),
          lt(financialRecordsTable.createdAt, end)
        )
      )
      .groupBy(proceduresTable.id, proceduresTable.name, proceduresTable.category)
      .orderBy(sql`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0) DESC`);

    res.json(
      results.map((r) => ({
        ...r,
        totalRevenue: Number(r.totalRevenue),
        totalSessions: Number(r.totalSessions),
        averageTicket:
          Number(r.totalSessions) > 0
            ? Number(r.totalRevenue) / Number(r.totalSessions)
            : 0,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/schedule-occupation", requirePermission("reports.read"), async (req, res) => {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const { startDate, endDate } = monthDateRange(year, month);

    const appointments = await db
      .select()
      .from(appointmentsTable)
      .where(and(gte(appointmentsTable.date, startDate), lte(appointmentsTable.date, endDate)));

    const totalSlots = appointments.length;
    const occupiedSlots = appointments.filter((a) =>
      ["concluido", "agendado", "confirmado"].includes(a.status)
    ).length;
    const canceledCount = appointments.filter((a) => a.status === "cancelado").length;
    const noShowCount = appointments.filter((a) => a.status === "faltou").length;

    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const byDayOfWeek: Record<string, number> = {};
    dayNames.forEach((d) => { byDayOfWeek[d] = 0; });

    for (const appt of appointments) {
      const dayOfWeek = new Date(appt.date + "T12:00:00").getDay();
      byDayOfWeek[dayNames[dayOfWeek]]++;
    }

    const activePatients = new Set(
      appointments
        .filter((a) => !["cancelado"].includes(a.status))
        .map((a) => a.patientId)
    ).size;

    const noShowRate = totalSlots > 0 ? (noShowCount / totalSlots) * 100 : 0;

    res.json({
      totalSlots,
      occupiedSlots,
      occupationRate: totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0,
      canceledCount,
      noShowCount,
      noShowRate,
      activePatients,
      byDayOfWeek: dayNames.map((d) => ({ dayOfWeek: d, count: byDayOfWeek[d] })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
