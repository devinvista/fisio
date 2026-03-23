import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import patientsRouter from "./patients.js";
import proceduresRouter from "./procedures.js";
import appointmentsRouter from "./appointments.js";
import medicalRecordsRouter from "./medical-records.js";
import financialRouter from "./financial.js";
import reportsRouter from "./reports.js";
import dashboardRouter from "./dashboard.js";
import usersRouter from "./users.js";
import storageRouter from "./storage.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/patients", patientsRouter);
router.use("/patients/:patientId", medicalRecordsRouter);
router.use("/procedures", proceduresRouter);
router.use("/appointments", appointmentsRouter);
router.use("/financial", financialRouter);
router.use("/reports", reportsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/storage", storageRouter);

export default router;
