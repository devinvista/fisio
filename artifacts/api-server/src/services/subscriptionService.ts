/**
 * subscriptionService — gerenciamento automático de assinaturas SaaS das clínicas
 *
 * Jobs:
 *  - runSubscriptionCheck(): detecta trials expirados, pagamentos vencidos,
 *    aplica período de carência e suspende clínicas inadimplentes.
 */

import { db } from "@workspace/db";
import { clinicSubscriptionsTable, subscriptionPlansTable, clinicsTable } from "@workspace/db";
import { eq, and, lte, inArray } from "drizzle-orm";
import { todayBRT } from "../lib/dateUtils.js";

const GRACE_PERIOD_DAYS = 7;

export interface SubscriptionCheckResult {
  trialsExpired: number;
  markedOverdue: number;
  suspended: number;
  errors: number;
  details: Array<{ clinicId: number; clinicName: string; action: string; reason?: string }>;
}

export async function runSubscriptionCheck(): Promise<SubscriptionCheckResult> {
  const result: SubscriptionCheckResult = {
    trialsExpired: 0,
    markedOverdue: 0,
    suspended: 0,
    errors: 0,
    details: [],
  };

  const today = todayBRT();

  try {
    const rows = await db
      .select({
        sub: clinicSubscriptionsTable,
        clinic: { id: clinicsTable.id, name: clinicsTable.name },
        plan: subscriptionPlansTable,
      })
      .from(clinicSubscriptionsTable)
      .leftJoin(clinicsTable, eq(clinicSubscriptionsTable.clinicId, clinicsTable.id))
      .leftJoin(subscriptionPlansTable, eq(clinicSubscriptionsTable.planId, subscriptionPlansTable.id));

    for (const row of rows) {
      const { sub, clinic } = row;
      const clinicId = sub.clinicId;
      const clinicName = clinic?.name ?? `Clínica #${clinicId}`;

      try {
        // 1. Trial expirado → marcar como "active" aguardando pagamento OU suspender se não pago
        if (sub.status === "trial" && sub.trialEndDate && sub.trialEndDate < today) {
          if (sub.paymentStatus === "paid" || sub.paymentStatus === "free") {
            await db
              .update(clinicSubscriptionsTable)
              .set({
                status: "active",
                currentPeriodStart: sub.trialEndDate,
                currentPeriodEnd: addDays(sub.trialEndDate, 30),
                updatedAt: new Date(),
              })
              .where(eq(clinicSubscriptionsTable.id, sub.id));

            result.trialsExpired++;
            result.details.push({ clinicId, clinicName, action: "trial_converted", reason: "Trial expirado, pagamento confirmado → ativo" });
          } else {
            await db
              .update(clinicSubscriptionsTable)
              .set({ status: "active", paymentStatus: "overdue", updatedAt: new Date() })
              .where(eq(clinicSubscriptionsTable.id, sub.id));

            result.trialsExpired++;
            result.details.push({ clinicId, clinicName, action: "trial_expired_overdue", reason: "Trial expirado sem pagamento → vencido" });
          }
          continue;
        }

        // 2. Assinatura ativa com período vencido → marcar como overdue
        if (sub.status === "active" && sub.paymentStatus !== "paid" && sub.paymentStatus !== "free") {
          if (sub.currentPeriodEnd && sub.currentPeriodEnd < today) {
            await db
              .update(clinicSubscriptionsTable)
              .set({ paymentStatus: "overdue", updatedAt: new Date() })
              .where(eq(clinicSubscriptionsTable.id, sub.id));

            result.markedOverdue++;
            result.details.push({ clinicId, clinicName, action: "marked_overdue", reason: "Período vencido sem pagamento" });
          }
          continue;
        }

        // 3. Overdue além do período de carência → suspender
        if (sub.status === "active" && sub.paymentStatus === "overdue" && sub.currentPeriodEnd) {
          const graceLimitDate = addDays(sub.currentPeriodEnd, GRACE_PERIOD_DAYS);
          if (today > graceLimitDate) {
            await db
              .update(clinicSubscriptionsTable)
              .set({ status: "suspended", updatedAt: new Date() })
              .where(eq(clinicSubscriptionsTable.id, sub.id));

            result.suspended++;
            result.details.push({
              clinicId,
              clinicName,
              action: "suspended",
              reason: `Inadimplente há mais de ${GRACE_PERIOD_DAYS} dias após vencimento`,
            });
          }
        }
      } catch (err: any) {
        result.errors++;
        result.details.push({ clinicId, clinicName, action: "error", reason: err?.message ?? "Erro desconhecido" });
      }
    }
  } catch (err) {
    console.error("[subscriptionService] Falha crítica no runSubscriptionCheck:", err);
    result.errors++;
  }

  return result;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
