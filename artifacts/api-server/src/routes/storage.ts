import { Router, type IRouter, type Request, type Response } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { generateUploadSignature } from "../lib/cloudinary.js";

const router: IRouter = Router();

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

const MAX_SIZE_BYTES = 20 * 1024 * 1024;

router.post("/uploads/request-url", authMiddleware, async (req: Request, res: Response) => {
  const { name, size, contentType, folder } = req.body;

  if (!name || !size || !contentType) {
    res.status(400).json({ error: "name, size e contentType são obrigatórios" });
    return;
  }

  if (!ALLOWED_TYPES.includes(contentType)) {
    res.status(400).json({ error: "Tipo de arquivo não permitido" });
    return;
  }

  if (size > MAX_SIZE_BYTES) {
    res.status(400).json({ error: "Arquivo muito grande (máx. 20MB)" });
    return;
  }

  try {
    const uploadFolder = folder || "fisiogest/uploads";
    const params = await generateUploadSignature(uploadFolder);
    res.json(params);
  } catch (error) {
    console.error("Error generating Cloudinary upload signature:", error);
    res.status(500).json({ error: "Falha ao gerar parâmetros de upload" });
  }
});

export default router;
