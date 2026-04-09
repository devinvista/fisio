/**
 * scheduler — CRON de cobranças recorrentes e políticas de agendamento
 *
 * Jobs configurados:
 * 1. Billing automático — diariamente às 06:00 BRT (09:00 UTC)
 *    Executa runBilling() com janela de tolerância de 3 dias.
 *
 * 2. Políticas de agendamento — a cada hora
 *    Executa runAppointmentPolicies():
 *    - Auto-confirmação: confirma agendamentos dentro da janela configurada
 *    - No-show: marca como "faltou" agendamentos cujo horário já passou
 *    - Taxa de no-show: gera lançamento financeiro de ausência se habilitado
 */

import cron from "node-cron";
import { runBilling } from "./services/billingService.js";
import { runAppointmentPolicies } from "./services/policyService.js";

const BILLING_CRON  = "0 9 * * *";  // 09:00 UTC = 06:00 BRT diariamente
const POLICIES_CRON = "0 * * * *";  // todo início de hora

export function startScheduler(): void {
  // ── Billing automático ─────────────────────────────────────────────────────
  if (!cron.validate(BILLING_CRON)) {
    console.error("[scheduler] Expressão CRON de billing inválida:", BILLING_CRON);
  } else {
    cron.schedule(BILLING_CRON, async () => {
      console.log(`[scheduler] Executando billing automático — ${new Date().toISOString()}`);
      try {
        const result = await runBilling({ toleranceDays: 3, triggeredBy: "scheduler" });
        console.log(
          `[scheduler] Billing concluído: ${result.generated} geradas, ` +
          `${result.skipped} puladas, ${result.errors} erros`
        );
        if (result.errors > 0) {
          console.error("[scheduler] Detalhes dos erros:", result.details.filter(d => d.action === "error"));
        }
      } catch (err) {
        console.error("[scheduler] Falha crítica no billing automático:", err);
      }
    }, { timezone: "America/Sao_Paulo" });

    console.log(`[scheduler] Billing automático agendado — ${BILLING_CRON} (06:00 BRT / 09:00 UTC)`);
  }

  // ── Políticas de agendamento ───────────────────────────────────────────────
  if (!cron.validate(POLICIES_CRON)) {
    console.error("[scheduler] Expressão CRON de políticas inválida:", POLICIES_CRON);
  } else {
    cron.schedule(POLICIES_CRON, async () => {
      console.log(`[scheduler] Executando políticas de agendamento — ${new Date().toISOString()}`);
      try {
        const result = await runAppointmentPolicies();
        console.log(
          `[scheduler] Políticas concluídas: ` +
          `${result.autoConfirmed} auto-confirmados, ` +
          `${result.noShowMarked} no-shows marcados, ` +
          `${result.noShowFeesGenerated} taxas geradas, ` +
          `${result.errors} erros`
        );
        if (result.errors > 0) {
          console.error("[scheduler] Erros nas políticas:", result.details.filter(d => d.action.includes("error")));
        }
      } catch (err) {
        console.error("[scheduler] Falha crítica nas políticas de agendamento:", err);
      }
    }, { timezone: "America/Sao_Paulo" });

    console.log(`[scheduler] Políticas de agendamento agendadas — ${POLICIES_CRON} (a cada hora)`);
  }
}
