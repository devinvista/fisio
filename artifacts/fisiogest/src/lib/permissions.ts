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

export function resolvePermissions(roles: string[]): Set<Permission> {
  const perms = new Set<Permission>();
  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role as Role] ?? [];
    for (const p of rolePerms) perms.add(p);
  }
  return perms;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  profissional: "Profissional",
  secretaria: "Secretaria",
};
