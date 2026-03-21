import { Response, NextFunction } from "express";
import { resolvePermissions, type Permission, type Role } from "@workspace/db";
import type { AuthRequest } from "./auth.js";

export function requirePermission(permission: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const roles = (req.userRoles ?? []) as Role[];
    const perms = resolvePermissions(roles);

    if (!perms.has(permission)) {
      res.status(403).json({
        error: "Forbidden",
        message: `Permission required: ${permission}`,
      });
      return;
    }

    next();
  };
}
