import { Router } from "express";
import { db } from "@workspace/db";
import { appointmentsTable, patientsTable, proceduresTable, financialRecordsTable, treatmentPlansTable } from "@workspace/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { todayBRT, nowBRT, monthDateRangeBRT } from "../lib/dateUtils.js";

const router = Router();
router.use(authMiddleware);

function apptClinicFilter(req: AuthRequest) {
  if (req.isSuperAdmin || !req.clinicId) return null;
  return eq(appointmentsTable.clinicId, req.clinicId);
}

function patientClinicFilter(req: AuthRequest) {
  if (req.isSuperAdmin || !req.clinicId) return null;
  return eq(patientsTable.clinicId, req.clinicId);
}

function financialClinicFilter(req: AuthRequest) {
  if (req.isSuperAdmin || !req.clinicId) return null;
  return eq(financialRecordsTable.clinicId, req.clinicId);
}

router.get("/", requirePermission("patients.read"), async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const today = todayBRT();
    const { year, month } = nowBRT();
    const { startDate, endDate } = monthDateRangeBRT(year, month);

    const apptFilter = apptClinicFilter(authReq);
    const patFilter = patientClinicFilter(authReq);
    const finFilter = financialClinicFilter(authReq);

    const todayAppts = await db
      .select({
        appointment: appointmentsTable,
        patient: patientsTable,
        procedure: proceduresTable
      })
      .from(appointmentsTable)
      .leftJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
      .where(and(eq(appointmentsTable.date, today), apptFilter ?? undefined))
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
          sql`${appointmentsTable.status} NOT IN ('cancelado', 'concluido', 'faltou')`,
          apptFilter ?? undefined
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
          gte(financialRecordsTable.paymentDate, startDate),
          lte(financialRecordsTable.paymentDate, endDate),
          finFilter ?? undefined
        )
      );

    const totalPatientsResult = await db
      .select({ count: sql<number>`count(distinct ${treatmentPlansTable.patientId})` })
      .from(treatmentPlansTable)
      .innerJoin(patientsTable, eq(treatmentPlansTable.patientId, patientsTable.id))
      .where(and(eq(treatmentPlansTable.status, "ativo"), patFilter ?? undefined));

    const totalMonthAppts = await db.select({ count: sql<number>`count(*)` })
      .from(appointmentsTable)
      .where(
        and(
          gte(appointmentsTable.date, startDate),
          lte(appointmentsTable.date, endDate),
          apptFilter ?? undefined
        )
      );

    const completedMonthAppts = await db.select({ count: sql<number>`count(*)` })
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.status, "concluido"),
          gte(appointmentsTable.date, startDate),
          lte(appointmentsTable.date, endDate),
          apptFilter ?? undefined
        )
      );

    const noShowMonthAppts = await db.select({ count: sql<number>`count(*)` })
      .from(appointmentsTable)
      .where(and(
        eq(appointmentsTable.status, "faltou"),
        gte(appointmentsTable.date, startDate),
        lte(appointmentsTable.date, endDate),
        apptFilter ?? undefined
      ));

    const totalMonth = Number(totalMonthAppts[0]?.count ?? 0);
    const completedMonth = Number(completedMonthAppts[0]?.count ?? 0);
    const noShowMonth = Number(noShowMonthAppts[0]?.count ?? 0);

    res.json({
      todayAppointments: todayAppts.map(({ appointment, patient, procedure }) => ({ ...appointment, patient, procedure })),
      upcomingAppointments: upcomingAppts.map(({ appointment, patient, procedure }) => ({ ...appointment, patient, procedure })),
      monthlyRevenue: Number(revenueResult[0]?.total ?? 0),
      totalPatients: Number(totalPatientsResult[0]?.count ?? 0),
      todayTotal: todayAppts.length,
      occupationRate: totalMonth > 0 ? (completedMonth / totalMonth) * 100 : 0,
      noShowCount: noShowMonth,
      noShowRate: totalMonth > 0 ? (noShowMonth / totalMonth) * 100 : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
