import { Router } from "express";
import { db } from "@workspace/db";
import { schedulesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();
router.use(authMiddleware);

async function getScheduleWithProfessional(id: number) {
  const result = await db
    .select({ schedule: schedulesTable, professional: usersTable })
    .from(schedulesTable)
    .leftJoin(usersTable, eq(schedulesTable.professionalId, usersTable.id))
    .where(eq(schedulesTable.id, id))
    .limit(1);

  if (!result[0]) return null;
  const { schedule, professional } = result[0];
  return { ...schedule, professional: professional ?? null };
}

router.get("/", requirePermission("appointments.read"), async (req: AuthRequest, res) => {
  try {
    const conditions = [];
    if (!req.isSuperAdmin && req.clinicId) {
      conditions.push(eq(schedulesTable.clinicId, req.clinicId));
    }

    const rows = conditions.length > 0
      ? await db
          .select({ schedule: schedulesTable, professional: usersTable })
          .from(schedulesTable)
          .leftJoin(usersTable, eq(schedulesTable.professionalId, usersTable.id))
          .where(and(...conditions))
          .orderBy(schedulesTable.createdAt)
      : await db
          .select({ schedule: schedulesTable, professional: usersTable })
          .from(schedulesTable)
          .leftJoin(usersTable, eq(schedulesTable.professionalId, usersTable.id))
          .orderBy(schedulesTable.createdAt);

    const schedules = rows.map(({ schedule, professional }) => ({
      ...schedule,
      professional: professional ?? null,
    }));

    res.json(schedules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", requirePermission("appointments.read"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const schedule = await getScheduleWithProfessional(id);
    if (!schedule) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    res.json(schedule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requirePermission("settings.manage"), async (req: AuthRequest, res) => {
  try {
    const {
      name,
      description,
      type,
      professionalId,
      workingDays,
      startTime,
      endTime,
      slotDurationMinutes,
      color,
    } = req.body;

    if (!name || !type) {
      res.status(400).json({ error: "Bad Request", message: "name e type são obrigatórios" });
      return;
    }

    if (!req.clinicId && !req.isSuperAdmin) {
      res.status(400).json({ error: "Bad Request", message: "clinicId não encontrado" });
      return;
    }

    const [schedule] = await db
      .insert(schedulesTable)
      .values({
        clinicId: req.clinicId!,
        name,
        description: description ?? null,
        type,
        professionalId: type === "professional" ? (professionalId ?? null) : null,
        workingDays: Array.isArray(workingDays) ? workingDays.join(",") : (workingDays ?? "1,2,3,4,5"),
        startTime: startTime ?? "08:00",
        endTime: endTime ?? "18:00",
        slotDurationMinutes: slotDurationMinutes ?? 30,
        isActive: true,
        color: color ?? "#6366f1",
      })
      .returning();

    const details = await getScheduleWithProfessional(schedule.id);
    res.status(201).json(details);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", requirePermission("settings.manage"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const {
      name,
      description,
      type,
      professionalId,
      workingDays,
      startTime,
      endTime,
      slotDurationMinutes,
      isActive,
      color,
    } = req.body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (professionalId !== undefined) updateData.professionalId = type === "professional" ? professionalId : null;
    if (workingDays !== undefined) updateData.workingDays = Array.isArray(workingDays) ? workingDays.join(",") : workingDays;
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (slotDurationMinutes !== undefined) updateData.slotDurationMinutes = slotDurationMinutes;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (color !== undefined) updateData.color = color;

    const [schedule] = await db
      .update(schedulesTable)
      .set(updateData)
      .where(eq(schedulesTable.id, id))
      .returning();

    if (!schedule) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const details = await getScheduleWithProfessional(schedule.id);
    res.json(details);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", requirePermission("settings.manage"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(schedulesTable).where(eq(schedulesTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
