import { Router } from "express";
import { db } from "@workspace/db";
import { proceduresTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    let query = db.select().from(proceduresTable);
    if (category) {
      query = query.where(eq(proceduresTable.category, category)) as any;
    }
    const procedures = await query.orderBy(proceduresTable.name);
    res.json(procedures);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, category, durationMinutes, price, cost, description, maxCapacity } = req.body;
    if (!name || !category || !durationMinutes || !price) {
      res.status(400).json({ error: "Bad Request", message: "name, category, durationMinutes e price são obrigatórios" });
      return;
    }
    const [procedure] = await db.insert(proceduresTable).values({
      name,
      category,
      durationMinutes: parseInt(durationMinutes),
      price: String(price),
      cost: cost ? String(cost) : "0",
      description,
      maxCapacity: maxCapacity ? parseInt(maxCapacity) : 1,
    }).returning();
    res.status(201).json(procedure);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, category, durationMinutes, price, cost, description, maxCapacity } = req.body;
    const [procedure] = await db.update(proceduresTable)
      .set({
        name,
        category,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : undefined,
        price: price ? String(price) : undefined,
        cost: cost !== undefined ? String(cost) : undefined,
        description,
        maxCapacity: maxCapacity !== undefined ? parseInt(maxCapacity) : undefined,
      })
      .where(eq(proceduresTable.id, id))
      .returning();
    if (!procedure) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    res.json(procedure);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(proceduresTable).where(eq(proceduresTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
