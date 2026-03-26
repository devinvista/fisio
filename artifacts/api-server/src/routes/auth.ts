import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, userRolesTable, clinicsTable } from "@workspace/db";
import type { Role } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { generateToken, authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();

function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

function isEmail(value: string): boolean {
  return value.includes("@");
}

function isCpf(value: string): boolean {
  return /^\d{11}$/.test(normalizeCpf(value));
}

async function getUserClinics(userId: number) {
  const rows = await db
    .select({
      clinicId: userRolesTable.clinicId,
      role: userRolesTable.role,
      clinicName: clinicsTable.name,
    })
    .from(userRolesTable)
    .leftJoin(clinicsTable, eq(userRolesTable.clinicId, clinicsTable.id))
    .where(and(eq(userRolesTable.userId, userId)));

  const clinicMap = new Map<number, { id: number; name: string; roles: Role[] }>();
  for (const row of rows) {
    if (!row.clinicId || !row.clinicName) continue;
    if (!clinicMap.has(row.clinicId)) {
      clinicMap.set(row.clinicId, { id: row.clinicId, name: row.clinicName, roles: [] });
    }
    clinicMap.get(row.clinicId)!.roles.push(row.role as Role);
  }
  return Array.from(clinicMap.values());
}

async function getUserRolesForClinic(userId: number, clinicId: number | null): Promise<Role[]> {
  const query = clinicId
    ? db
        .select({ role: userRolesTable.role })
        .from(userRolesTable)
        .where(and(eq(userRolesTable.userId, userId), eq(userRolesTable.clinicId, clinicId)))
    : db
        .select({ role: userRolesTable.role })
        .from(userRolesTable)
        .where(and(eq(userRolesTable.userId, userId), isNull(userRolesTable.clinicId)));

  const rows = await query;
  return rows.map((r) => r.role as Role);
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, cpf, password, clinicName } = req.body;

    if (!name || !cpf || !password) {
      res.status(400).json({ error: "Bad Request", message: "Nome, CPF e senha são obrigatórios" });
      return;
    }
    if (!clinicName) {
      res.status(400).json({ error: "Bad Request", message: "Nome da clínica é obrigatório" });
      return;
    }

    const normalizedCpf = normalizeCpf(cpf);
    const existingCpf = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.cpf, normalizedCpf))
      .limit(1);
    if (existingCpf.length > 0) {
      res.status(400).json({ error: "Bad Request", message: "CPF já cadastrado" });
      return;
    }

    if (email) {
      const existing = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email.toLowerCase().trim()))
        .limit(1);
      if (existing.length > 0) {
        res.status(400).json({ error: "Bad Request", message: "E-mail já cadastrado" });
        return;
      }
    }

    const [clinic] = await db
      .insert(clinicsTable)
      .values({ name: clinicName.trim() })
      .returning();

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({
        name,
        cpf: normalizedCpf,
        email: email ? email.toLowerCase().trim() : null,
        passwordHash,
        clinicId: clinic.id,
      })
      .returning();

    await db.insert(userRolesTable).values({ userId: user.id, clinicId: clinic.id, role: "admin" });

    const token = generateToken(user.id, ["admin"], clinic.id, false);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: ["admin"],
        clinicId: clinic.id,
        isSuperAdmin: false,
        createdAt: user.createdAt,
      },
      clinic: { id: clinic.id, name: clinic.name },
      clinics: [{ id: clinic.id, name: clinic.name, roles: ["admin"] }],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Falha no cadastro" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email: identifier, password, clinicId: preferredClinicId } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ error: "Bad Request", message: "Identificador e senha são obrigatórios" });
      return;
    }

    let user: typeof usersTable.$inferSelect | undefined;

    if (isEmail(identifier)) {
      const rows = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, identifier.toLowerCase().trim()))
        .limit(1);
      user = rows[0];
    } else if (isCpf(identifier)) {
      const normalizedCpf = normalizeCpf(identifier);
      const rows = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.cpf, normalizedCpf))
        .limit(1);
      user = rows[0];
    } else {
      res.status(401).json({ error: "Unauthorized", message: "Credenciais inválidas" });
      return;
    }

    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Credenciais inválidas" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "Credenciais inválidas" });
      return;
    }

    if (user.isSuperAdmin) {
      const token = generateToken(user.id, [], null, true);
      const clinics = await getUserClinics(user.id);
      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          roles: [],
          clinicId: null,
          isSuperAdmin: true,
          createdAt: user.createdAt,
        },
        clinics,
      });
    }

    const clinics = await getUserClinics(user.id);

    if (clinics.length === 0) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Usuário sem acesso a nenhuma clínica",
      });
    }

    let activeClinic = clinics[0];
    if (preferredClinicId) {
      const found = clinics.find((c) => c.id === Number(preferredClinicId));
      if (found) activeClinic = found;
    }

    const token = generateToken(user.id, activeClinic.roles, activeClinic.id, false);
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: activeClinic.roles,
        clinicId: activeClinic.id,
        isSuperAdmin: false,
        createdAt: user.createdAt,
      },
      clinic: { id: activeClinic.id, name: activeClinic.name },
      clinics,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Falha no login" });
  }
});

router.post("/switch-clinic", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { clinicId } = req.body;
    if (!clinicId) {
      res.status(400).json({ error: "Bad Request", message: "clinicId é obrigatório" });
      return;
    }

    if (req.isSuperAdmin) {
      const [clinic] = await db
        .select()
        .from(clinicsTable)
        .where(eq(clinicsTable.id, Number(clinicId)))
        .limit(1);
      if (!clinic) {
        res.status(404).json({ error: "Not Found", message: "Clínica não encontrada" });
        return;
      }
      const token = generateToken(req.userId!, [], null, true);
      return res.json({ token, clinicId: null });
    }

    const roles = await getUserRolesForClinic(req.userId!, Number(clinicId));
    if (roles.length === 0) {
      res.status(403).json({ error: "Forbidden", message: "Sem acesso a esta clínica" });
      return;
    }

    const token = generateToken(req.userId!, roles, Number(clinicId), false);
    return res.json({ token, clinicId: Number(clinicId), roles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Not Found", message: "Usuário não encontrado" });
      return;
    }

    const clinics = await getUserClinics(user.id);
    const activeClinicId = req.clinicId ?? null;
    const activeClinic = clinics.find((c) => c.id === activeClinicId) ?? null;

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      roles: activeClinic?.roles ?? req.userRoles ?? [],
      clinicId: activeClinicId,
      isSuperAdmin: user.isSuperAdmin,
      clinics,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
