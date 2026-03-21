import { Router } from "express";
import { db } from "@workspace/db";
import { appointmentsTable, patientsTable, proceduresTable, financialRecordsTable } from "@workspace/db";
import { eq, and, sql, gte, lte, lt } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();
router.use(authMiddleware);

function monthRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
  };
}

function monthDateRange(year: number, month: number): { startDate: string; endDate: string } {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

router.get("/", requirePermission("patients.read"), async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const { start, end } = monthRange(year, month);
    const { startDate, endDate } = monthDateRange(year, month);

    const todayAppts = await db
      .select({
        appointment: appointmentsTable,
        patient: patientsTable,
        procedure: proceduresTable
      })
      .from(appointmentsTable)
      .leftJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
      .where(eq(appointmentsTable.date, today))
      .orderBy(appointmentsTable.startTime);

    const upcomingAppts = await db
      .select({
        appointment: appointmentsTable,
        patient: patientsTable,
        procedure: proceduresTable
      })
      .from(appointmentsTable)
      .leftJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
      .where(
        and(
          gte(appointmentsTable.date, today),
          sql`status NOT IN ('cancelado', 'concluido', 'faltou')`
        )
      )
      .orderBy(appointmentsTable.date, appointmentsTable.startTime)
      .limit(5);

    const revenueResult = await db.select({
      total: sql<number>`COALESCE(SUM(amount::numeric), 0)`
    })
      .from(financialRecordsTable)
      .where(
        and(
          eq(financialRecordsTable.type, "receita"),
          gte(financialRecordsTable.createdAt, start),
          lt(financialRecordsTable.createdAt, end)
        )
      );

    const totalPatientsResult = await db.select({ count: sql<number>`count(*)` }).from(patientsTable);

    const totalMonthAppts = await db.select({ count: sql<number>`count(*)` })
      .from(appointmentsTable)
      .where(
        and(
          gte(appointmentsTable.date, startDate),
          lte(appointmentsTable.date, endDate)
        )
      );

    const completedMonthAppts = await db.select({ count: sql<number>`count(*)` })
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.status, "concluido"),
          gte(appointmentsTable.date, startDate),
          lte(appointmentsTable.date, endDate)
        )
      );

    const totalMonth = Number(totalMonthAppts[0]?.count ?? 0);
    const completedMonth = Number(completedMonthAppts[0]?.count ?? 0);

    res.json({
      todayAppointments: todayAppts.map(({ appointment, patient, procedure }) => ({ ...appointment, patient, procedure })),
      upcomingAppointments: upcomingAppts.map(({ appointment, patient, procedure }) => ({ ...appointment, patient, procedure })),
      monthlyRevenue: Number(revenueResult[0]?.total ?? 0),
      totalPatients: Number(totalPatientsResult[0]?.count ?? 0),
      todayTotal: todayAppts.length,
      occupationRate: totalMonth > 0 ? (completedMonth / totalMonth) * 100 : 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
