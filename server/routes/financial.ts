import { Router } from "express";
import { db } from "../../db/index.js";
import { financialRecordsTable, appointmentsTable, proceduresTable } from "../../db/index.js";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/dashboard", async (req, res) => {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

    const records = await db.select().from(financialRecordsTable)
      .where(
        and(
          gte(financialRecordsTable.createdAt, new Date(startDate)),
          lte(financialRecordsTable.createdAt, new Date(endDate + "T23:59:59"))
        )
      );

    const monthlyRevenue = records
      .filter(r => r.type === "receita")
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const monthlyExpenses = records
      .filter(r => r.type === "despesa")
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const completedAppts = await db.select({ count: sql<number>`count(*)` })
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.status, "concluido"),
          gte(appointmentsTable.date, startDate),
          lte(appointmentsTable.date, endDate)
        )
      );

    const totalAppts = await db.select({ count: sql<number>`count(*)` })
      .from(appointmentsTable)
      .where(
        and(
          gte(appointmentsTable.date, startDate),
          lte(appointmentsTable.date, endDate)
        )
      );

    const completedCount = Number(completedAppts[0]?.count ?? 0);
    const averageTicket = completedCount > 0 ? monthlyRevenue / completedCount : 0;

    const categoryRevenue = await db.select({
      category: proceduresTable.category,
      revenue: sql<number>`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0)`
    })
      .from(financialRecordsTable)
      .leftJoin(appointmentsTable, eq(financialRecordsTable.appointmentId, appointmentsTable.id))
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
      .where(
        and(
          eq(financialRecordsTable.type, "receita"),
          gte(financialRecordsTable.createdAt, new Date(startDate)),
          lte(financialRecordsTable.createdAt, new Date(endDate + "T23:59:59"))
        )
      )
      .groupBy(proceduresTable.category);

    const topProc = await db.select({
      name: proceduresTable.name,
      total: sql<number>`COALESCE(SUM(${financialRecordsTable.amount}::numeric), 0)`
    })
      .from(financialRecordsTable)
      .leftJoin(appointmentsTable, eq(financialRecordsTable.appointmentId, appointmentsTable.id))
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
      .where(
        and(
          eq(financialRecordsTable.type, "receita"),
          gte(financialRecordsTable.createdAt, new Date(startDate)),
          lte(financialRecordsTable.createdAt, new Date(endDate + "T23:59:59"))
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
      revenueByCategory: categoryRevenue.map(c => ({ category: c.category ?? "outros", revenue: Number(c.revenue) }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/records", async (req, res) => {
  try {
    const type = req.query.type as string | undefined;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    let query = db.select().from(financialRecordsTable);
    const conditions = [];

    if (type) conditions.push(eq(financialRecordsTable.type, type));
    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-31`;
      conditions.push(gte(financialRecordsTable.createdAt, new Date(startDate)));
      conditions.push(lte(financialRecordsTable.createdAt, new Date(endDate + "T23:59:59")));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const records = await query.orderBy(financialRecordsTable.createdAt);
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/records", async (req, res) => {
  try {
    const { type = "despesa", amount, description, category } = req.body;
    if (!amount || !description) {
      res.status(400).json({ error: "Bad Request", message: "Amount and description are required" });
      return;
    }

    const [record] = await db.insert(financialRecordsTable)
      .values({ type, amount: String(amount), description, category })
      .returning();
    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
