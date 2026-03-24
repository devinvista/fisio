import { Router } from "express";
import { db } from "@workspace/db";
import { blockedSlotsTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();
router.use(authMiddleware);

router.get("/", requirePermission("appointments.read"), async (req, res) => {
  try {
    const { startDate, endDate, date } = req.query;
    const conditions = [];

    if (date) conditions.push(eq(blockedSlotsTable.date, date as string));
    if (startDate) conditions.push(gte(blockedSlotsTable.date, startDate as string));
    if (endDate) conditions.push(lte(blockedSlotsTable.date, endDate as string));

    const slots = conditions.length > 0
      ? await db.select().from(blockedSlotsTable).where(and(...conditions)).orderBy(blockedSlotsTable.date, blockedSlotsTable.startTime)
      : await db.select().from(blockedSlotsTable).orderBy(blockedSlotsTable.date, blockedSlotsTable.startTime);

    res.json(slots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requirePermission("appointments.create"), async (req: AuthRequest, res) => {
  try {
    const { date, startTime, endTime, reason } = req.body;

    if (!date || !startTime || !endTime) {
      res.status(400).json({ error: "Bad Request", message: "date, startTime e endTime são obrigatórios" });
      return;
    }

    if (startTime >= endTime) {
      res.status(400).json({ error: "Bad Request", message: "startTime deve ser anterior ao endTime" });
      return;
    }

    const [slot] = await db
      .insert(blockedSlotsTable)
      .values({ date, startTime, endTime, reason: reason || null, userId: req.userId ?? null })
      .returning();

    res.status(201).json(slot);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", requirePermission("appointments.delete"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(blockedSlotsTable).where(eq(blockedSlotsTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
