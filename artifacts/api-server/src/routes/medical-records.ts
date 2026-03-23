import { Router, type Request } from "express";
import { db } from "@workspace/db";
import {
  anamnesisTable,
  evaluationsTable,
  treatmentPlansTable,
  evolutionsTable,
  dischargeSummariesTable,
  financialRecordsTable,
  appointmentsTable,
  proceduresTable,
  examAttachmentsTable,
} from "@workspace/db";
import { eq, desc, or } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { ObjectStorageService } from "../lib/objectStorage.js";

type P = { patientId: string };
type PEval = { patientId: string; evaluationId: string };
type PEvol = { patientId: string; evolutionId: string };

const router = Router({ mergeParams: true });
router.use(authMiddleware);

router.get("/anamnesis", requirePermission("medical.read"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const [anamnesis] = await db
      .select()
      .from(anamnesisTable)
      .where(eq(anamnesisTable.patientId, patientId));
    if (!anamnesis) {
      res.status(404).json({ error: "Not Found", message: "Anamnese não encontrada" });
      return;
    }
    res.json(anamnesis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/anamnesis", requirePermission("medical.write"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const { mainComplaint, diseaseHistory, medicalHistory, medications, allergies, familyHistory, lifestyle, painScale } = req.body;

    const existing = await db
      .select()
      .from(anamnesisTable)
      .where(eq(anamnesisTable.patientId, patientId));

    let anamnesis;
    if (existing.length > 0) {
      [anamnesis] = await db
        .update(anamnesisTable)
        .set({ mainComplaint, diseaseHistory, medicalHistory, medications, allergies, familyHistory, lifestyle, painScale, updatedAt: new Date() })
        .where(eq(anamnesisTable.patientId, patientId))
        .returning();
    } else {
      [anamnesis] = await db
        .insert(anamnesisTable)
        .values({ patientId, mainComplaint, diseaseHistory, medicalHistory, medications, allergies, familyHistory, lifestyle, painScale })
        .returning();
    }
    res.json(anamnesis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/evaluations", requirePermission("medical.read"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const evaluations = await db
      .select()
      .from(evaluationsTable)
      .where(eq(evaluationsTable.patientId, patientId))
      .orderBy(desc(evaluationsTable.createdAt));
    res.json(evaluations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/evaluations", requirePermission("medical.write"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const { inspection, posture, rangeOfMotion, muscleStrength, orthopedicTests, functionalDiagnosis } = req.body;
    const [evaluation] = await db
      .insert(evaluationsTable)
      .values({ patientId, inspection, posture, rangeOfMotion, muscleStrength, orthopedicTests, functionalDiagnosis })
      .returning();
    res.status(201).json(evaluation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/evaluations/:evaluationId", requirePermission("medical.write"), async (req: Request<PEval>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const evaluationId = parseInt(req.params.evaluationId);
    const { inspection, posture, rangeOfMotion, muscleStrength, orthopedicTests, functionalDiagnosis } = req.body;

    const [existing] = await db
      .select()
      .from(evaluationsTable)
      .where(eq(evaluationsTable.id, evaluationId));
    if (!existing || existing.patientId !== patientId) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const [updated] = await db
      .update(evaluationsTable)
      .set({ inspection, posture, rangeOfMotion, muscleStrength, orthopedicTests, functionalDiagnosis, updatedAt: new Date() })
      .where(eq(evaluationsTable.id, evaluationId))
      .returning();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/evaluations/:evaluationId", requirePermission("medical.write"), async (req: Request<PEval>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const evaluationId = parseInt(req.params.evaluationId);

    const [existing] = await db
      .select()
      .from(evaluationsTable)
      .where(eq(evaluationsTable.id, evaluationId));
    if (!existing || existing.patientId !== patientId) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    await db.delete(evaluationsTable).where(eq(evaluationsTable.id, evaluationId));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/treatment-plan", requirePermission("medical.read"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const [plan] = await db
      .select()
      .from(treatmentPlansTable)
      .where(eq(treatmentPlansTable.patientId, patientId));
    if (!plan) {
      res.status(404).json({ error: "Not Found", message: "Plano de tratamento não encontrado" });
      return;
    }
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/treatment-plan", requirePermission("medical.write"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const { objectives, techniques, frequency, estimatedSessions, status = "ativo" } = req.body;

    const existing = await db
      .select()
      .from(treatmentPlansTable)
      .where(eq(treatmentPlansTable.patientId, patientId));

    let plan;
    if (existing.length > 0) {
      [plan] = await db
        .update(treatmentPlansTable)
        .set({ objectives, techniques, frequency, estimatedSessions, status, updatedAt: new Date() })
        .where(eq(treatmentPlansTable.patientId, patientId))
        .returning();
    } else {
      [plan] = await db
        .insert(treatmentPlansTable)
        .values({ patientId, objectives, techniques, frequency, estimatedSessions, status })
        .returning();
    }
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/evolutions", requirePermission("medical.read"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const evolutions = await db
      .select()
      .from(evolutionsTable)
      .where(eq(evolutionsTable.patientId, patientId))
      .orderBy(desc(evolutionsTable.createdAt));
    res.json(evolutions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/evolutions", requirePermission("medical.write"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const { appointmentId, description, patientResponse, clinicalNotes, complications } = req.body;
    const [evolution] = await db
      .insert(evolutionsTable)
      .values({ patientId, appointmentId, description, patientResponse, clinicalNotes, complications })
      .returning();
    res.status(201).json(evolution);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/evolutions/:evolutionId", requirePermission("medical.write"), async (req: Request<PEvol>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const evolutionId = parseInt(req.params.evolutionId);
    const { appointmentId, description, patientResponse, clinicalNotes, complications } = req.body;

    const [existing] = await db
      .select()
      .from(evolutionsTable)
      .where(eq(evolutionsTable.id, evolutionId));
    if (!existing || existing.patientId !== patientId) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const [updated] = await db
      .update(evolutionsTable)
      .set({ appointmentId: appointmentId || null, description, patientResponse, clinicalNotes, complications })
      .where(eq(evolutionsTable.id, evolutionId))
      .returning();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/evolutions/:evolutionId", requirePermission("medical.write"), async (req: Request<PEvol>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const evolutionId = parseInt(req.params.evolutionId);

    const [existing] = await db
      .select()
      .from(evolutionsTable)
      .where(eq(evolutionsTable.id, evolutionId));
    if (!existing || existing.patientId !== patientId) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    await db.delete(evolutionsTable).where(eq(evolutionsTable.id, evolutionId));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/appointments", requirePermission("appointments.read"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const rows = await db
      .select({ appointment: appointmentsTable, procedure: proceduresTable })
      .from(appointmentsTable)
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
      .where(eq(appointmentsTable.patientId, patientId))
      .orderBy(desc(appointmentsTable.date));

    res.json(rows.map((r) => ({ ...r.appointment, procedure: r.procedure })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/discharge-summary", requirePermission("medical.read"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const [summary] = await db
      .select()
      .from(dischargeSummariesTable)
      .where(eq(dischargeSummariesTable.patientId, patientId));
    if (!summary) {
      res.status(404).json({ error: "Not Found", message: "Alta fisioterapêutica não encontrada" });
      return;
    }
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/discharge-summary", requirePermission("medical.write"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const { dischargeDate, dischargeReason, achievedResults, recommendations } = req.body;

    const existing = await db
      .select()
      .from(dischargeSummariesTable)
      .where(eq(dischargeSummariesTable.patientId, patientId));

    let summary;
    if (existing.length > 0) {
      [summary] = await db
        .update(dischargeSummariesTable)
        .set({ dischargeDate, dischargeReason, achievedResults, recommendations, updatedAt: new Date() })
        .where(eq(dischargeSummariesTable.patientId, patientId))
        .returning();
    } else {
      [summary] = await db
        .insert(dischargeSummariesTable)
        .values({ patientId, dischargeDate, dischargeReason, achievedResults, recommendations })
        .returning();
    }
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/financial", requirePermission("financial.read"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const rows = await db
      .select({
        record: financialRecordsTable,
        appointment: appointmentsTable,
        procedure: proceduresTable,
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

    res.json(rows.map((r) => ({ ...r.record, appointment: r.appointment, procedure: r.procedure })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/financial", requirePermission("financial.write"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const { type, amount, description, category } = req.body;

    if (!type || !amount || !description) {
      res.status(400).json({ error: "Bad Request", message: "type, amount e description são obrigatórios" });
      return;
    }

    const [record] = await db
      .insert(financialRecordsTable)
      .values({ type, amount: String(amount), description, category, patientId })
      .returning();

    res.status(201).json(record);
  } catch (err: any) {
    if (err?.cause?.code === "23503" || err?.code === "23503") {
      res.status(404).json({ error: "Not Found", message: "Paciente não encontrado" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Exam Attachments ─────────────────────────────────────────────────────────

const objectStorageService = new ObjectStorageService();

type PAttach = { patientId: string; attachmentId: string };

router.get("/attachments", requirePermission("medical.read"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const attachments = await db
      .select()
      .from(examAttachmentsTable)
      .where(eq(examAttachmentsTable.patientId, patientId))
      .orderBy(desc(examAttachmentsTable.uploadedAt));
    res.json(attachments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/attachments", requirePermission("medical.write"), async (req: Request<P>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const { originalFilename, contentType, fileSize, objectPath, description } = req.body;

    if (!originalFilename || !contentType || !fileSize || !objectPath) {
      res.status(400).json({ error: "Campos obrigatórios: originalFilename, contentType, fileSize, objectPath" });
      return;
    }

    const [attachment] = await db
      .insert(examAttachmentsTable)
      .values({ patientId, originalFilename, contentType, fileSize, objectPath, description: description || null })
      .returning();

    res.status(201).json(attachment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/attachments/:attachmentId", requirePermission("medical.write"), async (req: Request<PAttach>, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const attachmentId = parseInt(req.params.attachmentId);

    const [existing] = await db
      .select()
      .from(examAttachmentsTable)
      .where(eq(examAttachmentsTable.id, attachmentId));

    if (!existing || existing.patientId !== patientId) {
      res.status(404).json({ error: "Anexo não encontrado" });
      return;
    }

    try {
      const objectFile = await objectStorageService.getObjectEntityFile(existing.objectPath);
      await objectFile.delete();
    } catch {
      // If GCS delete fails, still remove from DB
    }

    await db.delete(examAttachmentsTable).where(eq(examAttachmentsTable.id, attachmentId));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
