import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { patientPhotosTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { z } from "zod/v4";
import { parseIntParam, validateBody } from "../lib/validate.js";

const router = Router({ mergeParams: true });
const objectStorageService = new ObjectStorageService();

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_PHOTO_SIZE = 15 * 1024 * 1024; // 15MB

const VIEW_TYPES = ["frontal", "lateral_d", "lateral_e", "posterior", "detalhe"] as const;

const createPhotoSchema = z.object({
  objectPath: z.string().min(1).regex(/^\/objects\//, "Caminho do arquivo inválido"),
  originalFilename: z.string().optional(),
  contentType: z.enum(ALLOWED_IMAGE_TYPES as [string, ...string[]]).optional(),
  fileSize: z.number().int().positive().max(MAX_PHOTO_SIZE).optional(),
  viewType: z.enum(VIEW_TYPES),
  takenAt: z.string().datetime().optional(),
  sessionLabel: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const updatePhotoSchema = z.object({
  sessionLabel: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// GET /patients/:patientId/photos — list all photos
router.get("/", authMiddleware, requirePermission("medical.read"), async (req: Request, res: Response) => {
  try {
    const patientId = parseIntParam(req.params.patientId, res, "Paciente");
    if (patientId === null) return;

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
router.post("/", authMiddleware, requirePermission("medical.write"), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const patientId = parseIntParam(req.params.patientId, res, "Paciente");
    if (patientId === null) return;

    const body = validateBody(createPhotoSchema, req.body, res);
    if (!body) return;

    const { objectPath, originalFilename, contentType, fileSize, viewType, takenAt, sessionLabel, notes } = body;

    const [photo] = await db.insert(patientPhotosTable).values({
      patientId,
      clinicId: authReq.clinicId ?? null,
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
router.delete("/:photoId", authMiddleware, requirePermission("medical.write"), async (req: Request, res: Response) => {
  try {
    const patientId = parseIntParam(req.params.patientId, res, "Paciente");
    const photoId = parseIntParam(req.params.photoId, res, "Foto");
    if (patientId === null || photoId === null) return;

    const [existing] = await db
      .select()
      .from(patientPhotosTable)
      .where(and(eq(patientPhotosTable.id, photoId), eq(patientPhotosTable.patientId, patientId)));

    if (!existing) {
      res.status(404).json({ error: "Foto não encontrada" });
      return;
    }

    try {
      const objectFile = await objectStorageService.getObjectEntityFile(existing.objectPath);
      await objectFile.delete();
    } catch (storageErr) {
      console.error("Falha ao excluir foto do storage (continuando com remoção do banco):", storageErr);
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
router.patch("/:photoId", authMiddleware, requirePermission("medical.write"), async (req: Request, res: Response) => {
  try {
    const patientId = parseIntParam(req.params.patientId, res, "Paciente");
    const photoId = parseIntParam(req.params.photoId, res, "Foto");
    if (patientId === null || photoId === null) return;

    const body = validateBody(updatePhotoSchema, req.body, res);
    if (!body) return;

    const [updated] = await db
      .update(patientPhotosTable)
      .set(body)
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
