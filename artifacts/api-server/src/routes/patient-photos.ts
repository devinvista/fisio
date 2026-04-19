import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { patientPhotosTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { z } from "zod/v4";
import { validateBody } from "../lib/validate.js";

const router = Router({ mergeParams: true });
const objectStorageService = new ObjectStorageService();

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];
const MAX_PHOTO_SIZE = 15 * 1024 * 1024; // 15MB

const VIEW_TYPES = ["frontal", "lateral_d", "lateral_e", "posterior", "detalhe"] as const;

const createPhotoSchema = z.object({
  objectPath: z.string().min(1),
  originalFilename: z.string().optional(),
  contentType: z.string().optional(),
  fileSize: z.number().int().optional(),
  viewType: z.enum(VIEW_TYPES),
  takenAt: z.string().optional(),
  sessionLabel: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

// GET /patients/:patientId/photos — list all photos
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const patientId = parseInt(req.params.patientId);
    if (isNaN(patientId)) {
      res.status(400).json({ error: "ID de paciente inválido" });
      return;
    }

    const photos = await db
      .select()
      .from(patientPhotosTable)
      .where(eq(patientPhotosTable.patientId, patientId))
      .orderBy(desc(patientPhotosTable.takenAt));

    res.json(photos);
  } catch (error) {
    console.error("Error fetching patient photos:", error);
    res.status(500).json({ error: "Falha ao buscar fotos" });
  }
});

// POST /patients/:patientId/photos — save photo record after upload
router.post("/", authMiddleware, validateBody(createPhotoSchema), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const patientId = parseInt(req.params.patientId);
    if (isNaN(patientId)) {
      res.status(400).json({ error: "ID de paciente inválido" });
      return;
    }

    const { objectPath, originalFilename, contentType, fileSize, viewType, takenAt, sessionLabel, notes } = req.body;

    const [photo] = await db.insert(patientPhotosTable).values({
      patientId,
      clinicId: authReq.user?.clinicId ?? null,
      objectPath,
      originalFilename,
      contentType,
      fileSize,
      viewType,
      takenAt: takenAt ? new Date(takenAt) : new Date(),
      sessionLabel,
      notes,
    }).returning();

    res.status(201).json(photo);
  } catch (error) {
    console.error("Error saving patient photo:", error);
    res.status(500).json({ error: "Falha ao salvar foto" });
  }
});

// DELETE /patients/:patientId/photos/:photoId
router.delete("/:photoId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const photoId = parseInt(req.params.photoId);
    if (isNaN(patientId) || isNaN(photoId)) {
      res.status(400).json({ error: "IDs inválidos" });
      return;
    }

    const [deleted] = await db
      .delete(patientPhotosTable)
      .where(and(eq(patientPhotosTable.id, photoId), eq(patientPhotosTable.patientId, patientId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Foto não encontrada" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting patient photo:", error);
    res.status(500).json({ error: "Falha ao excluir foto" });
  }
});

// PATCH /patients/:patientId/photos/:photoId — update notes/label
router.patch("/:photoId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const photoId = parseInt(req.params.photoId);
    if (isNaN(patientId) || isNaN(photoId)) {
      res.status(400).json({ error: "IDs inválidos" });
      return;
    }

    const { notes, sessionLabel } = req.body;

    const [updated] = await db
      .update(patientPhotosTable)
      .set({ notes, sessionLabel })
      .where(and(eq(patientPhotosTable.id, photoId), eq(patientPhotosTable.patientId, patientId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Foto não encontrada" });
      return;
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating patient photo:", error);
    res.status(500).json({ error: "Falha ao atualizar foto" });
  }
});

export default router;
