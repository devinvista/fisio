import type { Response } from "express";

export function parseIntParam(value: string | string[] | undefined, res: Response, label = "ID"): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    res.status(400).json({ error: "Bad Request", message: `${label} é obrigatório` });
    return null;
  }
  const n = parseInt(raw, 10);
  if (isNaN(n) || n <= 0) {
    res.status(400).json({ error: "Bad Request", message: `${label} inválido` });
    return null;
  }
  return n;
}
