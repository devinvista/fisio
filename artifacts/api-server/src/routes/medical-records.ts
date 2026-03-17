import { Router } from "express";
import { db } from "@workspace/db";
import {
  anamnesisTable,
  evaluationsTable,
  treatmentPlansTable,
  evolutionsTable,
  financialRecordsTable,
  appointmentsTable,
  proceduresTable
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(authMiddleware);

router.get("/anamnesis", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const [anamnesis] = await db.select().from(anamnesisTable).where(eq(anamnesisTable.patientId, patientId));
    if (!anamnesis) {
      res.status(404).json({ error: "Not Found", message: "Anamnesis not found" });
      return;
    }
    res.json(anamnesis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/anamnesis", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const { mainComplaint, diseaseHistory, medicalHistory, medications, allergies, familyHistory, lifestyle, painScale } = req.body;

    const existing = await db.select().from(anamnesisTable).where(eq(anamnesisTable.patientId, patientId));

    let anamnesis;
    if (existing.length > 0) {
      [anamnesis] = await db.update(anamnesisTable)
        .set({ mainComplaint, diseaseHistory, medicalHistory, medications, allergies, familyHistory, lifestyle, painScale, updatedAt: new Date() })
        .where(eq(anamnesisTable.patientId, patientId))
        .returning();
    } else {
      [anamnesis] = await db.insert(anamnesisTable)
        .values({ patientId, mainComplaint, diseaseHistory, medicalHistory, medications, allergies, familyHistory, lifestyle, painScale })
        .returning();
    }
    res.json(anamnesis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/evaluations", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const evaluations = await db.select().from(evaluationsTable)
      .where(eq(evaluationsTable.patientId, patientId))
      .orderBy(desc(evaluationsTable.createdAt));
    res.json(evaluations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/evaluations", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const { inspection, posture, rangeOfMotion, muscleStrength, orthopedicTests, functionalDiagnosis } = req.body;

    const [evaluation] = await db.insert(evaluationsTable)
      .values({ patientId, inspection, posture, rangeOfMotion, muscleStrength, orthopedicTests, functionalDiagnosis })
      .returning();
    res.status(201).json(evaluation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/treatment-plan", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const [plan] = await db.select().from(treatmentPlansTable).where(eq(treatmentPlansTable.patientId, patientId));
    if (!plan) {
      res.status(404).json({ error: "Not Found", message: "Treatment plan not found" });
      return;
    }
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/treatment-plan", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const { objectives, techniques, frequency, estimatedSessions, status = "ativo" } = req.body;

    const existing = await db.select().from(treatmentPlansTable).where(eq(treatmentPlansTable.patientId, patientId));

    let plan;
    if (existing.length > 0) {
      [plan] = await db.update(treatmentPlansTable)
        .set({ objectives, techniques, frequency, estimatedSessions, status, updatedAt: new Date() })
        .where(eq(treatmentPlansTable.patientId, patientId))
        .returning();
    } else {
      [plan] = await db.insert(treatmentPlansTable)
        .values({ patientId, objectives, techniques, frequency, estimatedSessions, status })
        .returning();
    }
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/evolutions", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const evolutions = await db.select().from(evolutionsTable)
      .where(eq(evolutionsTable.patientId, patientId))
      .orderBy(desc(evolutionsTable.createdAt));
    res.json(evolutions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/evolutions", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const { appointmentId, description, patientResponse, clinicalNotes, complications } = req.body;

    const [evolution] = await db.insert(evolutionsTable)
      .values({ patientId, appointmentId, description, patientResponse, clinicalNotes, complications })
      .returning();
    res.status(201).json(evolution);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/appointments", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const rows = await db
      .select({
        appointment: appointmentsTable,
        procedure: proceduresTable,
      })
      .from(appointmentsTable)
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
      .where(eq(appointmentsTable.patientId, patientId))
      .orderBy(desc(appointmentsTable.date));

    res.json(rows.map(r => ({ ...r.appointment, procedure: r.procedure })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/financial", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const rows = await db
      .select({
        record: financialRecordsTable,
        appointment: appointmentsTable,
        procedure: proceduresTable,
      })
      .from(financialRecordsTable)
      .innerJoin(appointmentsTable, eq(financialRecordsTable.appointmentId, appointmentsTable.id))
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
      .where(eq(appointmentsTable.patientId, patientId))
      .orderBy(desc(financialRecordsTable.createdAt));

    res.json(rows.map(r => ({ ...r.record, appointment: r.appointment, procedure: r.procedure })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
