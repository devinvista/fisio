import { Router } from "express";
import { db } from "../../db/index.js";
import {
  anamnesisTable,
  evaluationsTable,
  treatmentPlansTable,
  evolutionsTable,
  dischargeSummariesTable,
  financialRecordsTable,
  appointmentsTable,
  proceduresTable,
} from "../../db/index.js";
import { eq, desc, or } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(authMiddleware);

// ─── Anamnesis ───────────────────────────────────────────────────────────────

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

// ─── Evaluations ─────────────────────────────────────────────────────────────

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

router.put("/evaluations/:evaluationId", async (req, res) => {
  try {
    const evaluationId = parseInt(req.params.evaluationId);
    const { inspection, posture, rangeOfMotion, muscleStrength, orthopedicTests, functionalDiagnosis } = req.body;

    const [evaluation] = await db.update(evaluationsTable)
      .set({ inspection, posture, rangeOfMotion, muscleStrength, orthopedicTests, functionalDiagnosis, updatedAt: new Date() })
      .where(eq(evaluationsTable.id, evaluationId))
      .returning();

    if (!evaluation) {
      res.status(404).json({ error: "Not Found", message: "Evaluation not found" });
      return;
    }
    res.json(evaluation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/evaluations/:evaluationId", async (req, res) => {
  try {
    const evaluationId = parseInt(req.params.evaluationId);
    await db.delete(evaluationsTable).where(eq(evaluationsTable.id, evaluationId));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Treatment Plan ───────────────────────────────────────────────────────────

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

// ─── Evolutions ───────────────────────────────────────────────────────────────

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

router.put("/evolutions/:evolutionId", async (req, res) => {
  try {
    const evolutionId = parseInt(req.params.evolutionId);
    const { appointmentId, description, patientResponse, clinicalNotes, complications } = req.body;

    const [evolution] = await db.update(evolutionsTable)
      .set({
        appointmentId: appointmentId ? Number(appointmentId) : null,
        description,
        patientResponse,
        clinicalNotes,
        complications,
      })
      .where(eq(evolutionsTable.id, evolutionId))
      .returning();

    if (!evolution) {
      res.status(404).json({ error: "Not Found", message: "Evolution not found" });
      return;
    }
    res.json(evolution);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/evolutions/:evolutionId", async (req, res) => {
  try {
    const evolutionId = parseInt(req.params.evolutionId);
    await db.delete(evolutionsTable).where(eq(evolutionsTable.id, evolutionId));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Discharge Summary ────────────────────────────────────────────────────────

router.get("/discharge-summary", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const [summary] = await db.select().from(dischargeSummariesTable).where(eq(dischargeSummariesTable.patientId, patientId));
    if (!summary) {
      res.status(404).json({ error: "Not Found", message: "Discharge summary not found" });
      return;
    }
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/discharge-summary", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const { dischargeDate, dischargeReason, achievedResults, recommendations } = req.body;

    if (!dischargeDate || !dischargeReason) {
      res.status(400).json({ error: "Bad Request", message: "dischargeDate and dischargeReason are required" });
      return;
    }

    const existing = await db.select().from(dischargeSummariesTable).where(eq(dischargeSummariesTable.patientId, patientId));

    let summary;
    if (existing.length > 0) {
      [summary] = await db.update(dischargeSummariesTable)
        .set({ dischargeDate, dischargeReason, achievedResults, recommendations, updatedAt: new Date() })
        .where(eq(dischargeSummariesTable.patientId, patientId))
        .returning();
    } else {
      [summary] = await db.insert(dischargeSummariesTable)
        .values({ patientId, dischargeDate, dischargeReason, achievedResults, recommendations })
        .returning();
    }
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Patient Financial Records ────────────────────────────────────────────────

router.get("/financial", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);

    const records = await db
      .select({
        id: financialRecordsTable.id,
        type: financialRecordsTable.type,
        amount: financialRecordsTable.amount,
        description: financialRecordsTable.description,
        category: financialRecordsTable.category,
        patientId: financialRecordsTable.patientId,
        appointmentId: financialRecordsTable.appointmentId,
        createdAt: financialRecordsTable.createdAt,
        procedure: {
          id: proceduresTable.id,
          name: proceduresTable.name,
        },
        appointment: {
          id: appointmentsTable.id,
          date: appointmentsTable.date,
        },
      })
      .from(financialRecordsTable)
      .leftJoin(appointmentsTable, eq(financialRecordsTable.appointmentId, appointmentsTable.id))
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
      .where(
        or(
          eq(financialRecordsTable.patientId, patientId),
          eq(appointmentsTable.patientId, patientId)
        )
      )
      .orderBy(desc(financialRecordsTable.createdAt));

    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
