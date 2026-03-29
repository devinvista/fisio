/**
 * scheduler — CRON de cobranças recorrentes
 *
 * Executa runBilling() todos os dias às 06:00 horário de Brasília (BRT = UTC-3).
 * Em UTC isso corresponde a 09:00 → expressão: "0 9 * * *"
 *
 * Se o servidor estiver fora do ar no dia exato de cobrança, a janela
 * de tolerância (3 dias) do billingService garante o catch-up automático
 * na próxima execução.
 */

import cron from "node-cron";
import { runBilling } from "./services/billingService.js";

const CRON_EXPRESSION = "0 9 * * *"; // 09:00 UTC = 06:00 BRT diariamente

export function startScheduler(): void {
  if (!cron.validate(CRON_EXPRESSION)) {
    console.error("[scheduler] Expressão CRON inválida:", CRON_EXPRESSION);
    return;
  }

  cron.schedule(CRON_EXPRESSION, async () => {
    console.log(`[scheduler] Executando billing automático — ${new Date().toISOString()}`);
    try {
      const result = await runBilling({ toleranceDays: 3 });
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
  }, {
    timezone: "America/Sao_Paulo",
  });

  console.log(`[scheduler] Billing automático agendado — ${CRON_EXPRESSION} (06:00 BRT / 09:00 UTC)`);
}
