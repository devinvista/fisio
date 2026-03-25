import { Router } from "express";
import { db } from "@workspace/db";
import {
  appointmentsTable,
  patientsTable,
  proceduresTable,
  blockedSlotsTable,
} from "@workspace/db";
import { eq, and, sql, ne } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── GET /api/public/procedures ────────────────────────────────────────────────
// Lista procedimentos disponíveis para agendamento online
router.get("/procedures", async (_req, res) => {
  try {
    const procedures = await db
      .select({
        id: proceduresTable.id,
        name: proceduresTable.name,
        category: proceduresTable.category,
        durationMinutes: proceduresTable.durationMinutes,
        price: proceduresTable.price,
        description: proceduresTable.description,
        maxCapacity: proceduresTable.maxCapacity,
      })
      .from(proceduresTable)
      .where(eq(proceduresTable.onlineBookingEnabled, true))
      .orderBy(proceduresTable.category, proceduresTable.name);

    res.json(procedures);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── GET /api/public/available-slots ──────────────────────────────────────────
// Retorna horários disponíveis para um procedimento e data
router.get("/available-slots", async (req, res) => {
  try {
    const { date, procedureId, clinicStart = "08:00", clinicEnd = "18:00" } = req.query;

    if (!date || !procedureId) {
      res.status(400).json({ error: "date e procedureId são obrigatórios" });
      return;
    }

    const [procedure] = await db
      .select()
      .from(proceduresTable)
      .where(
        and(
          eq(proceduresTable.id, parseInt(procedureId as string)),
          eq(proceduresTable.onlineBookingEnabled, true)
        )
      );

    if (!procedure) {
      res.status(404).json({ error: "Procedimento não encontrado ou não disponível para agendamento online" });
      return;
    }

    const openMin = timeToMinutes(clinicStart as string);
    const closeMin = timeToMinutes(clinicEnd as string);
    const duration = procedure.durationMinutes;
    const maxCap = procedure.maxCapacity ?? 1;

    const existingAppts = await db
      .select({
        id: appointmentsTable.id,
        procedureId: appointmentsTable.procedureId,
        startTime: appointmentsTable.startTime,
        endTime: appointmentsTable.endTime,
      })
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.date, date as string),
          sql`status NOT IN ('cancelado', 'faltou')`
        )
      );

    const blockedSlots = await db
      .select({ startTime: blockedSlotsTable.startTime, endTime: blockedSlotsTable.endTime })
      .from(blockedSlotsTable)
      .where(eq(blockedSlotsTable.date, date as string));

    const slots: { time: string; available: boolean; spotsLeft: number }[] = [];

    for (let start = openMin; start + duration <= closeMin; start += 30) {
      const startTime = minutesToTime(start);
      const slotEnd = start + duration;

      const isBlocked = blockedSlots.some(
        (b) => timeToMinutes(b.startTime) < slotEnd && timeToMinutes(b.endTime) > start
      );

      if (isBlocked) {
        slots.push({ time: startTime, available: false, spotsLeft: 0 });
        continue;
      }

      let spotsLeft: number;

      if (maxCap > 1) {
        const sameSessionCount = existingAppts.filter(
          (a) => a.procedureId === procedure.id && a.startTime === startTime
        ).length;

        const hasConflictingSession = existingAppts.some(
          (a) =>
            a.procedureId === procedure.id &&
            a.startTime !== startTime &&
            timeToMinutes(a.startTime) < slotEnd &&
            timeToMinutes(a.endTime) > start
        );

        spotsLeft = hasConflictingSession ? 0 : Math.max(0, maxCap - sameSessionCount);
      } else {
        const occupiedCount = existingAppts.filter(
          (a) =>
            timeToMinutes(a.startTime) < slotEnd &&
            timeToMinutes(a.endTime) > start
        ).length;
        spotsLeft = Math.max(0, maxCap - occupiedCount);
      }

      slots.push({ time: startTime, available: spotsLeft > 0, spotsLeft });
    }

    res.json({
      date,
      procedure: {
        id: procedure.id,
        name: procedure.name,
        durationMinutes: procedure.durationMinutes,
        price: procedure.price,
        maxCapacity: maxCap,
      },
      slots: slots.filter((s) => s.available),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── POST /api/public/book ─────────────────────────────────────────────────────
// Cria um agendamento público (sem autenticação)
router.post("/book", async (req, res) => {
  try {
    const { procedureId, date, startTime, patientName, patientPhone, patientEmail, patientCpf, notes } = req.body;

    if (!procedureId || !date || !startTime || !patientName || !patientPhone) {
      res.status(400).json({
        error: "Bad Request",
        message: "procedureId, date, startTime, patientName e patientPhone são obrigatórios",
      });
      return;
    }

    // Verificar procedimento disponível para agendamento online
    const [procedure] = await db
      .select()
      .from(proceduresTable)
      .where(
        and(
          eq(proceduresTable.id, parseInt(procedureId)),
          eq(proceduresTable.onlineBookingEnabled, true)
        )
      );

    if (!procedure) {
      res.status(404).json({ error: "Procedimento não disponível para agendamento online" });
      return;
    }

    const endTime = addMinutes(startTime, procedure.durationMinutes);
    const maxCapacity = procedure.maxCapacity ?? 1;

    // Verificar conflito de horário
    const conditions = [
      eq(appointmentsTable.date, date),
      sql`status NOT IN ('cancelado', 'faltou')`,
    ];

    if (maxCapacity > 1) {
      const sameSession = await db
        .select({ id: appointmentsTable.id })
        .from(appointmentsTable)
        .where(
          and(
            eq(appointmentsTable.date, date),
            eq(appointmentsTable.procedureId, procedure.id),
            eq(appointmentsTable.startTime, startTime),
            sql`status NOT IN ('cancelado', 'faltou')`
          )
        );

      if (sameSession.length >= maxCapacity) {
        res.status(409).json({
          error: "Conflict",
          message: `Horário lotado: ${sameSession.length}/${maxCapacity} vagas ocupadas.`,
        });
        return;
      }
    } else {
      const existing = await db
        .select({ id: appointmentsTable.id })
        .from(appointmentsTable)
        .where(
          and(
            ...conditions,
            sql`start_time < ${endTime} AND end_time > ${startTime}`
          )
        );

      if (existing.length > 0) {
        res.status(409).json({
          error: "Conflict",
          message: `Horário indisponível: já existe um agendamento entre ${startTime} e ${endTime}.`,
        });
        return;
      }
    }

    // Buscar ou criar paciente pelo CPF (se fornecido) ou telefone
    let patientId: number;

    if (patientCpf) {
      const existingPatient = await db
        .select({ id: patientsTable.id })
        .from(patientsTable)
        .where(eq(patientsTable.cpf, patientCpf.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")))
        .limit(1);

      if (existingPatient.length > 0) {
        patientId = existingPatient[0].id;
        // Atualizar telefone e email se necessário
        await db
          .update(patientsTable)
          .set({ phone: patientPhone, ...(patientEmail ? { email: patientEmail } : {}) })
          .where(eq(patientsTable.id, patientId));
      } else {
        const cpfFormatted = patientCpf.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        const [newPatient] = await db
          .insert(patientsTable)
          .values({
            name: patientName,
            cpf: cpfFormatted,
            phone: patientPhone,
            email: patientEmail || null,
          })
          .returning({ id: patientsTable.id });
        patientId = newPatient.id;
      }
    } else {
      // Sem CPF: criar paciente com telefone como identificador único tentativo
      const existingByPhone = await db
        .select({ id: patientsTable.id })
        .from(patientsTable)
        .where(eq(patientsTable.phone, patientPhone))
        .limit(1);

      if (existingByPhone.length > 0) {
        patientId = existingByPhone[0].id;
      } else {
        // Gerar CPF placeholder único para não violar constraint UNIQUE
        const phonePlaceholder = `000.${patientPhone.replace(/\D/g, "").slice(-6, -3)}.${patientPhone.replace(/\D/g, "").slice(-3)}-00`;
        const [newPatient] = await db
          .insert(patientsTable)
          .values({
            name: patientName,
            cpf: phonePlaceholder,
            phone: patientPhone,
            email: patientEmail || null,
          })
          .returning({ id: patientsTable.id });
        patientId = newPatient.id;
      }
    }

    // Gerar token único para o agendamento
    const bookingToken = randomUUID();

    // Criar agendamento
    const [appointment] = await db
      .insert(appointmentsTable)
      .values({
        patientId,
        procedureId: procedure.id,
        date,
        startTime,
        endTime,
        status: "agendado",
        notes: notes || null,
        bookingToken,
        source: "online",
      })
      .returning();

    res.status(201).json({
      success: true,
      bookingToken,
      appointment: {
        id: appointment.id,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        procedure: {
          name: procedure.name,
          durationMinutes: procedure.durationMinutes,
          price: procedure.price,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── GET /api/public/booking/:token ────────────────────────────────────────────
// Consulta os detalhes de um agendamento pelo token
router.get("/booking/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const result = await db
      .select({
        appointment: appointmentsTable,
        patient: patientsTable,
        procedure: proceduresTable,
      })
      .from(appointmentsTable)
      .leftJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .leftJoin(proceduresTable, eq(appointmentsTable.procedureId, proceduresTable.id))
      .where(eq(appointmentsTable.bookingToken, token))
      .limit(1);

    if (!result[0]) {
      res.status(404).json({ error: "Agendamento não encontrado" });
      return;
    }

    const { appointment, patient, procedure } = result[0];
    res.json({
      id: appointment.id,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
      notes: appointment.notes,
      bookingToken: appointment.bookingToken,
      patient: patient
        ? { name: patient.name, phone: patient.phone, email: patient.email }
        : null,
      procedure: procedure
        ? { id: procedure.id, name: procedure.name, durationMinutes: procedure.durationMinutes, price: procedure.price }
        : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── DELETE /api/public/booking/:token ─────────────────────────────────────────
// Cancela um agendamento pelo token (paciente cancela o próprio agendamento)
router.delete("/booking/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const [appointment] = await db
      .select({ id: appointmentsTable.id, status: appointmentsTable.status, date: appointmentsTable.date })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.bookingToken, token));

    if (!appointment) {
      res.status(404).json({ error: "Agendamento não encontrado" });
      return;
    }

    if (appointment.status === "cancelado") {
      res.status(400).json({ error: "Agendamento já está cancelado" });
      return;
    }

    if (appointment.status === "concluido") {
      res.status(400).json({ error: "Não é possível cancelar uma consulta já concluída" });
      return;
    }

    // Verificar se a data já passou
    const today = new Date().toISOString().split("T")[0];
    if (appointment.date < today) {
      res.status(400).json({ error: "Não é possível cancelar uma consulta passada" });
      return;
    }

    await db
      .update(appointmentsTable)
      .set({ status: "cancelado" })
      .where(eq(appointmentsTable.id, appointment.id));

    res.json({ success: true, message: "Agendamento cancelado com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
