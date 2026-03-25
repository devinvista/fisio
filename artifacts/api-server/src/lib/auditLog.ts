import { db } from "@workspace/db";
import { auditLogTable } from "@workspace/db";

interface AuditEntry {
  userId?: number | null;
  userName?: string | null;
  patientId?: number | null;
  action: "create" | "update" | "delete";
  entityType: string;
  entityId?: number | null;
  summary?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogTable).values({
      userId: entry.userId ?? null,
      userName: entry.userName ?? null,
      patientId: entry.patientId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary ?? null,
    });
  } catch (err) {
    console.error("[auditLog] Failed to write audit entry:", err);
  }
}
