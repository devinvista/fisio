import { db, financialRecordsTable } from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  allocateReceivable,
  postCashReceipt,
  postExpense,
  postPackageSale,
  postReceivableRevenue,
  postReceivableSettlement,
  postWalletDeposit,
  postWalletUsage,
} from "../services/accountingService.js";
import { todayBRT } from "../utils/dateUtils.js";

const RECEIVABLE_TYPES = ["creditoAReceber", "cobrancaSessao", "cobrancaMensal", "faturaConsolidada", "pendenteFatura"];
const INACTIVE_STATUSES = ["cancelado", "estornado"];

function isInactive(status: string) {
  return INACTIVE_STATUSES.includes(status);
}

function amountOf(record: typeof financialRecordsTable.$inferSelect) {
  return Number(record.amount ?? 0);
}

async function main() {
  const records = await db
    .select()
    .from(financialRecordsTable)
    .where(and(isNull(financialRecordsTable.accountingEntryId), isNull(financialRecordsTable.recognizedEntryId)))
    .orderBy(financialRecordsTable.createdAt);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    try {
      if (isInactive(record.status) || amountOf(record) <= 0) {
        skipped++;
        continue;
      }

      if (record.transactionType === "pagamento") {
        continue;
      }

      let entry: { id: number } | null = null;
      const common = {
        clinicId: record.clinicId ?? null,
        entryDate: record.paymentDate ?? record.dueDate ?? todayBRT(),
        amount: amountOf(record),
        description: record.description,
        sourceType: "financial_record",
        sourceId: record.id,
        patientId: record.patientId,
        appointmentId: record.appointmentId,
        procedureId: record.procedureId,
        subscriptionId: record.subscriptionId,
        financialRecordId: record.id,
      };

      if (record.type === "despesa") {
        entry = await postExpense(common);
        await db.update(financialRecordsTable).set({ accountingEntryId: entry.id }).where(eq(financialRecordsTable.id, record.id));
        created++;
        continue;
      }

      if (record.transactionType === "depositoCarteira") {
        entry = await postWalletDeposit(common);
      } else if (record.transactionType === "usoCarteira") {
        entry = await postWalletUsage(common);
      } else if (record.transactionType === "vendaPacote") {
        entry = await postPackageSale({ ...common, paid: record.status === "pago" });
      } else if (RECEIVABLE_TYPES.includes(record.transactionType ?? "")) {
        if (record.status === "pago") {
          entry = await postCashReceipt(common);
        } else {
          entry = await postReceivableRevenue(common);
        }
      } else if (record.type === "receita" && record.status === "pago") {
        entry = await postCashReceipt(common);
      } else if (record.type === "receita") {
        entry = await postReceivableRevenue(common);
      }

      if (entry) {
        await db
          .update(financialRecordsTable)
          .set({
            accountingEntryId: entry.id,
            recognizedEntryId: record.status === "pago" || record.transactionType === "depositoCarteira" || record.transactionType === "vendaPacote" ? null : entry.id,
            settlementEntryId: record.status === "pago" ? entry.id : null,
          })
          .where(eq(financialRecordsTable.id, record.id));
        created++;
      } else {
        skipped++;
      }
    } catch (error) {
      errors++;
      console.error(`Erro ao migrar financial_record #${record.id}:`, error);
    }
  }

  const payments = await db
    .select()
    .from(financialRecordsTable)
    .where(and(
      eq(financialRecordsTable.transactionType, "pagamento"),
      eq(financialRecordsTable.status, "pago"),
      isNull(financialRecordsTable.accountingEntryId)
    ))
    .orderBy(financialRecordsTable.createdAt);

  for (const payment of payments) {
    try {
      let remaining = amountOf(payment);
      if (remaining <= 0 || !payment.patientId) {
        skipped++;
        continue;
      }

      const pending = await db
        .select()
        .from(financialRecordsTable)
        .where(and(
          eq(financialRecordsTable.patientId, payment.patientId),
          eq(financialRecordsTable.status, "pendente"),
          inArray(financialRecordsTable.transactionType, [...RECEIVABLE_TYPES, "vendaPacote"])
        ))
        .orderBy(financialRecordsTable.dueDate, financialRecordsTable.createdAt);

      let firstEntryId: number | null = null;

      for (const receivable of pending) {
        if (remaining <= 0) break;
        const allocationAmount = Math.min(remaining, amountOf(receivable));
        const settlement = await postReceivableSettlement({
          clinicId: payment.clinicId ?? null,
          entryDate: payment.paymentDate ?? todayBRT(),
          amount: allocationAmount,
          description: `Backfill baixa recebível — ${receivable.description}`,
          sourceType: "financial_record",
          sourceId: payment.id,
          patientId: payment.patientId,
          appointmentId: receivable.appointmentId,
          procedureId: receivable.procedureId,
          subscriptionId: receivable.subscriptionId,
          financialRecordId: payment.id,
        });
        firstEntryId ??= settlement.id;

        const receivableEntryId = receivable.accountingEntryId ?? receivable.recognizedEntryId;
        if (receivableEntryId) {
          await allocateReceivable({
            clinicId: payment.clinicId ?? null,
            paymentEntryId: settlement.id,
            receivableEntryId,
            patientId: payment.patientId,
            amount: allocationAmount,
            allocatedAt: payment.paymentDate ?? todayBRT(),
          });
        }

        if (allocationAmount >= amountOf(receivable)) {
          await db
            .update(financialRecordsTable)
            .set({ status: "pago", paymentDate: payment.paymentDate ?? todayBRT(), paymentMethod: payment.paymentMethod, settlementEntryId: settlement.id })
            .where(eq(financialRecordsTable.id, receivable.id));
        }

        remaining = Math.round((remaining - allocationAmount) * 100) / 100;
      }

      if (remaining > 0) {
        const direct = await postCashReceipt({
          clinicId: payment.clinicId ?? null,
          entryDate: payment.paymentDate ?? todayBRT(),
          amount: remaining,
          description: payment.description,
          sourceType: "financial_record",
          sourceId: payment.id,
          patientId: payment.patientId,
          procedureId: payment.procedureId,
          financialRecordId: payment.id,
        });
        firstEntryId ??= direct.id;
      }

      await db
        .update(financialRecordsTable)
        .set({ accountingEntryId: firstEntryId, settlementEntryId: firstEntryId })
        .where(eq(financialRecordsTable.id, payment.id));
      created++;
    } catch (error) {
      errors++;
      console.error(`Erro ao migrar pagamento #${payment.id}:`, error);
    }
  }

  console.log(`Backfill contábil concluído: ${created} lançamentos criados, ${skipped} registros ignorados, ${errors} erros.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill contábil falhou:", error);
    process.exit(1);
  });
