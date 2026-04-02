import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";
import { authMiddleware } from "../middleware/auth.js";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_SIZE_BYTES = 20 * 1024 * 1024;

router.post("/uploads/request-url", authMiddleware, async (req: Request, res: Response) => {
  const { name, size, contentType } = req.body;

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
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    res.status(500).json({ error: "Falha ao gerar URL de upload" });
  }
});

router.get("/public-objects/{*filePath}", async (req: Request, res: Response) => {
  try {
    const filePath = (req.params as Record<string, string>).filePath ?? "";

    if (!filePath || filePath.includes("..") || filePath.startsWith("/")) {
      res.status(400).json({ error: "Caminho de arquivo inválido" });
      return;
    }

    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "Arquivo não encontrado" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Error serving public object:", error);
    res.status(500).json({ error: "Falha ao servir arquivo" });
  }
});

router.get("/objects/{*objPath}", authMiddleware, async (req: Request, res: Response) => {
  try {
    const wildcardParam = (req.params as Record<string, string>).objPath ?? "";
    const objectPath = `/objects/${wildcardParam}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Arquivo não encontrado" });
      return;
    }
    console.error("Error serving object:", error);
    res.status(500).json({ error: "Falha ao servir arquivo" });
  }
});

export default router;
