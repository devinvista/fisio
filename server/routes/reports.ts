import { Router } from "express";
import { db } from "../../db/index.js";
import { financialRecordsTable, appointmentsTable, proceduresTable } from "../../db/index.js";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

router.get("/monthly-revenue", async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const result = [];

    for (let month = 1; month <= 12; month++) {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

      const records = await db.select({
        type: financialRecordsTable.type,
        total: sql<number>`SUM(amount::numeric)`
      })
        .from(financialRecordsTable)
        .where(
          and(
            gte(financialRecordsTable.createdAt, new Date(startDate)),
            lte(financialRecordsTable.createdAt, new Date(endDate + "T23:59:59"))
          )
        )
        .groupBy(financialRecordsTable.type);

      const revenue = Number(records.find(r => r.type === "receita")?.total ?? 0);
      const expenses = Number(records.find(r => r.type === "despesa")?.total ?? 0);

      result.push({ month, monthName: MONTH_NAMES[month - 1], revenue, expenses, profit: revenue - expenses });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/procedure-revenue", async (req, res) => {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

    const results = await db.select({
      procedureId: proceduresTable.id,
      procedureName: proceduresTable.name,
      category: proceduresTable.category,
      totalRevenue: sql<number>`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0)`,
      totalSessions: sql<number>`COUNT(${financialRecordsTable.id})`
    })
      .from(proceduresTable)
      .leftJoin(appointmentsTable, eq(appointmentsTable.procedureId, proceduresTable.id))
      .leftJoin(
        financialRecordsTable,
        and(
          eq(financialRecordsTable.appointmentId, appointmentsTable.id),
          eq(financialRecordsTable.type, "receita"),
          gte(financialRecordsTable.createdAt, new Date(startDate)),
          lte(financialRecordsTable.createdAt, new Date(endDate + "T23:59:59"))
        )
      )
      .groupBy(proceduresTable.id, proceduresTable.name, proceduresTable.category)
      .orderBy(sql`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0) DESC`);

    res.json(results.map(r => ({
      ...r,
      totalRevenue: Number(r.totalRevenue),
      totalSessions: Number(r.totalSessions),
      averageTicket: Number(r.totalSessions) > 0 ? Number(r.totalRevenue) / Number(r.totalSessions) : 0
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/schedule-occupation", async (req, res) => {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

    const appointments = await db.select().from(appointmentsTable)
      .where(
        and(
          gte(appointmentsTable.date, startDate),
          lte(appointmentsTable.date, endDate)
        )
      );

    const totalSlots = appointments.length;
    const occupiedSlots = appointments.filter(a => ["concluido", "agendado", "confirmado"].includes(a.status)).length;
    const canceledCount = appointments.filter(a => a.status === "cancelado").length;
    const noShowCount = appointments.filter(a => a.status === "faltou").length;

    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const byDayOfWeek: Record<string, number> = {};
    dayNames.forEach(d => { byDayOfWeek[d] = 0; });

    for (const appt of appointments) {
      const dayOfWeek = new Date(appt.date + "T12:00:00").getDay();
      byDayOfWeek[dayNames[dayOfWeek]]++;
    }

    res.json({
      totalSlots,
      occupiedSlots,
      occupationRate: totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0,
      canceledCount,
      noShowCount,
      byDayOfWeek: dayNames.map(d => ({ dayOfWeek: d, count: byDayOfWeek[d] }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
