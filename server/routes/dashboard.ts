import { Router } from "express";
import { db } from "../../db/index.js";
import { appointmentsTable, patientsTable, proceduresTable, financialRecordsTable } from "../../db/index.js";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

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
          gte(financialRecordsTable.createdAt, new Date(startDate)),
          lte(financialRecordsTable.createdAt, new Date(endDate + "T23:59:59"))
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
