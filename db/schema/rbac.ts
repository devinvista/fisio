import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ROLES = ["admin", "profissional", "secretaria"] as const;
export type Role = (typeof ROLES)[number];

export const ALL_PERMISSIONS = [
  "patients.read",
  "patients.create",
  "patients.update",
  "patients.delete",
  "medical.read",
  "medical.write",
  "appointments.read",
  "appointments.create",
  "appointments.update",
  "appointments.delete",
  "financial.read",
  "financial.write",
  "reports.read",
  "procedures.manage",
  "users.manage",
  "settings.manage",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  secretaria: [
    "patients.read",
    "appointments.read",
    "appointments.create",
    "appointments.update",
  ],
  profissional: [
    "patients.read",
    "patients.create",
    "patients.update",
    "appointments.read",
    "appointments.create",
    "appointments.update",
    "medical.read",
    "medical.write",
    "financial.read",
    "reports.read",
    "procedures.manage",
  ],
  admin: [
    "patients.read",
    "patients.create",
    "patients.update",
    "patients.delete",
    "medical.read",
    "medical.write",
    "appointments.read",
    "appointments.create",
    "appointments.update",
    "appointments.delete",
    "financial.read",
    "financial.write",
    "reports.read",
    "procedures.manage",
    "users.manage",
    "settings.manage",
  ],
};

export function resolvePermissions(roles: Role[]): Set<Permission> {
  const perms = new Set<Permission>();
  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role] ?? [];
    for (const p of rolePerms) perms.add(p);
  }
  return perms;
}

export const userRolesTable = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const permissionsTable = pgTable("permissions", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
});

export const rolesPermissionsTable = pgTable("roles_permissions", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  permissionKey: text("permission_key")
    .notNull()
    .references(() => permissionsTable.key, { onDelete: "cascade" }),
});

export type UserRole = typeof userRolesTable.$inferSelect;
export type InsertUserRole = typeof userRolesTable.$inferInsert;
