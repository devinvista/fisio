import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, userRolesTable } from "@workspace/db";
import type { Role } from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";
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

async function getUserRoles(userId: number): Promise<Role[]> {
  const rows = await db
    .select({ role: userRolesTable.role })
    .from(userRolesTable)
    .where(eq(userRolesTable.userId, userId));
  return rows.map((r) => r.role as Role);
}

async function assignRoles(userId: number, roles: Role[]): Promise<void> {
  if (roles.length === 0) return;
  await db.insert(userRolesTable).values(
    roles.map((role) => ({ userId, role }))
  );
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, cpf, password, roles } = req.body;
    const roleList: Role[] = Array.isArray(roles) && roles.length > 0
      ? roles
      : ["profissional"];

    if (!name || !email || !password) {
      res.status(400).json({ error: "Bad Request", message: "Nome, e-mail e senha são obrigatórios" });
      return;
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existing.length > 0) {
      res.status(400).json({ error: "Bad Request", message: "E-mail já cadastrado" });
      return;
    }

    if (cpf) {
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
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({
        name,
        email,
        cpf: cpf ? normalizeCpf(cpf) : null,
        passwordHash,
      })
      .returning();

    await assignRoles(user.id, roleList);

    const token = generateToken(user.id, roleList);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: roleList,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Falha no cadastro" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email: identifier, password } = req.body;
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

    const roles = await getUserRoles(user.id);
    const token = generateToken(user.id, roles);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Falha no login" });
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

    const roles = await getUserRoles(user.id);
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      roles,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
