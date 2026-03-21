import { db } from "../lib/db/src";
import {
  usersTable,
  patientsTable,
  proceduresTable,
  appointmentsTable,
  financialRecordsTable,
  userRolesTable,
} from "../lib/db/src/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const DEMO_USERS = [
  { name: "Admin Sistema", email: "admin@fisiogest.com.br", password: "123456", roles: ["admin"] },
  { name: "Dra. Mariana Costa", email: "fisio@fisiogest.com.br", password: "123456", roles: ["profissional"] },
  { name: "Secretária Maria", email: "secretaria@fisiogest.com.br", password: "123456", roles: ["secretaria"] },
  { name: "Dr. Marta Oliveira", email: "marta@fisiogest.com.br", password: "123456", roles: ["admin", "profissional"] },
];

const DEMO_PROCEDURES = [
  { name: "Fisioterapia Ortopédica", category: "fisioterapia", durationMinutes: 60, price: "180.00", cost: "40.00", maxCapacity: 1 },
  { name: "Fisioterapia Neurológica", category: "fisioterapia", durationMinutes: 60, price: "200.00", cost: "45.00", maxCapacity: 1 },
  { name: "RPG - Reeducação Postural Global", category: "pilates", durationMinutes: 60, price: "160.00", cost: "35.00", maxCapacity: 4 },
  { name: "Pilates Clínico Individual", category: "pilates", durationMinutes: 55, price: "150.00", cost: "30.00", maxCapacity: 1 },
  { name: "Pilates em Grupo", category: "pilates", durationMinutes: 55, price: "90.00", cost: "20.00", maxCapacity: 8 },
  { name: "Drenagem Linfática", category: "estetica", durationMinutes: 60, price: "140.00", cost: "30.00", maxCapacity: 1 },
  { name: "Massagem Relaxante", category: "estetica", durationMinutes: 60, price: "120.00", cost: "25.00", maxCapacity: 1 },
  { name: "Radiofrequência", category: "estetica", durationMinutes: 45, price: "180.00", cost: "40.00", maxCapacity: 1 },
  { name: "Ultrassom Terapêutico", category: "fisioterapia", durationMinutes: 30, price: "80.00", cost: "15.00", maxCapacity: 2 },
  { name: "Eletroestimulação", category: "fisioterapia", durationMinutes: 30, price: "70.00", cost: "12.00", maxCapacity: 3 },
];

const DEMO_PATIENTS = [
  { name: "Ana Rodrigues", cpf: "111.222.333-44", phone: "(11) 99999-0001", email: "ana@email.com", birthDate: "1985-03-15", profession: "Professora", address: "Rua das Flores, 123 - SP" },
  { name: "Bruno Martins", cpf: "222.333.444-55", phone: "(11) 99999-0002", email: "bruno@email.com", birthDate: "1990-07-22", profession: "Engenheiro", address: "Av. Paulista, 456 - SP" },
  { name: "Carla Ferreira", cpf: "333.444.555-66", phone: "(11) 99999-0003", email: "carla@email.com", birthDate: "1978-11-08", profession: "Médica", address: "Rua Augusta, 789 - SP" },
  { name: "Diego Santos", cpf: "444.555.666-77", phone: "(11) 99999-0004", email: "diego@email.com", birthDate: "1995-01-30", profession: "Designer", address: "Rua Oscar Freire, 321 - SP" },
  { name: "Elena Sousa", cpf: "555.666.777-88", phone: "(11) 99999-0005", email: "elena@email.com", birthDate: "1982-09-14", profession: "Advogada", address: "Rua da Consolação, 654 - SP" },
  { name: "Fernanda Lima", cpf: "666.777.888-99", phone: "(11) 99999-0006", email: "fernanda@email.com", birthDate: "1975-06-20", profession: "Empresária", address: "Jardins, SP" },
  { name: "Gabriel Costa", cpf: "777.888.999-00", phone: "(11) 99999-0007", email: "gabriel@email.com", birthDate: "1992-12-05", profession: "Atleta", address: "Morumbi, SP" },
  { name: "Helena Nunes", cpf: "888.999.000-11", phone: "(11) 99999-0008", email: "helena@email.com", birthDate: "1988-04-18", profession: "Contadora", address: "Itaim Bibi, SP" },
];

async function seed() {
  console.log("🌱 Iniciando seed de dados demo...");

  console.log("👥 Criando usuários demo...");
  const userIds: Record<string, number> = {};
  for (const u of DEMO_USERS) {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, u.email));
    if (existing.length > 0) {
      console.log(`  ⏭  Usuário ${u.email} já existe, atualizando roles...`);
      const userId = existing[0].id;
      userIds[u.email] = userId;
      await db.delete(userRolesTable).where(eq(userRolesTable.userId, userId));
      await db.insert(userRolesTable).values(u.roles.map((role) => ({ userId, role })));
      continue;
    }
    const passwordHash = await bcrypt.hash(u.password, 10);
    const [user] = await db.insert(usersTable).values({ name: u.name, email: u.email, passwordHash }).returning();
    userIds[u.email] = user.id;
    await db.insert(userRolesTable).values(u.roles.map((role) => ({ userId: user.id, role })));
    console.log(`  ✅ ${u.name} (${u.roles.join(", ")})`);
  }

  const profissionalId = userIds["fisio@fisiogest.com.br"];

  console.log("🏥 Criando procedimentos...");
  const procedureIds: number[] = [];
  for (const p of DEMO_PROCEDURES) {
    const existing = await db.select().from(proceduresTable).where(eq(proceduresTable.name, p.name));
    if (existing.length > 0) {
      procedureIds.push(existing[0].id);
      continue;
    }
    const [proc] = await db.insert(proceduresTable).values(p).returning();
    procedureIds.push(proc.id);
    console.log(`  ✅ ${p.name}`);
  }

  console.log("🧑‍⚕️ Criando pacientes...");
  const patientIds: number[] = [];
  for (const p of DEMO_PATIENTS) {
    const existing = await db.select().from(patientsTable).where(eq(patientsTable.cpf, p.cpf));
    if (existing.length > 0) {
      patientIds.push(existing[0].id);
      continue;
    }
    const [patient] = await db.insert(patientsTable).values(p).returning();
    patientIds.push(patient.id);
    console.log(`  ✅ ${p.name}`);
  }

  if (patientIds.length > 0 && procedureIds.length > 0) {
    console.log("📅 Criando agendamentos de exemplo...");
    const today = new Date();
    const fmtDate = (d: Date) => d.toISOString().split("T")[0];

    const appointments = [
      { daysOffset: -14, patientIdx: 0, procIdx: 0, start: "08:00", status: "concluido" },
      { daysOffset: -14, patientIdx: 1, procIdx: 1, start: "10:00", status: "concluido" },
      { daysOffset: -7, patientIdx: 2, procIdx: 2, start: "09:00", status: "concluido" },
      { daysOffset: -7, patientIdx: 3, procIdx: 3, start: "11:00", status: "concluido" },
      { daysOffset: -3, patientIdx: 4, procIdx: 5, start: "14:00", status: "concluido" },
      { daysOffset: -2, patientIdx: 5, procIdx: 6, start: "15:00", status: "concluido" },
      { daysOffset: -1, patientIdx: 6, procIdx: 0, start: "09:00", status: "concluido" },
      { daysOffset: -1, patientIdx: 7, procIdx: 7, start: "11:00", status: "faltou" },
      { daysOffset: 0, patientIdx: 0, procIdx: 3, start: "08:00", status: "agendado" },
      { daysOffset: 0, patientIdx: 1, procIdx: 4, start: "10:00", status: "agendado" },
      { daysOffset: 0, patientIdx: 2, procIdx: 5, start: "14:00", status: "confirmado" },
      { daysOffset: 1, patientIdx: 3, procIdx: 1, start: "09:00", status: "agendado" },
      { daysOffset: 1, patientIdx: 4, procIdx: 2, start: "11:00", status: "agendado" },
      { daysOffset: 2, patientIdx: 5, procIdx: 0, start: "08:00", status: "agendado" },
      { daysOffset: 3, patientIdx: 6, procIdx: 6, start: "15:00", status: "agendado" },
      { daysOffset: 7, patientIdx: 7, procIdx: 3, start: "10:00", status: "agendado" },
    ];

    for (const appt of appointments) {
      const apptDate = new Date(today);
      apptDate.setDate(today.getDate() + appt.daysOffset);

      const procIdx = appt.procIdx < procedureIds.length ? appt.procIdx : 0;
      const patIdx = appt.patientIdx < patientIds.length ? appt.patientIdx : 0;
      const procId = procedureIds[procIdx];
      const [proc] = await db.select().from(proceduresTable).where(eq(proceduresTable.id, procId));
      if (!proc) continue;

      const [h, m] = appt.start.split(":").map(Number);
      const endMin = h * 60 + m + proc.durationMinutes;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

      const [appointment] = await db
        .insert(appointmentsTable)
        .values({
          patientId: patientIds[patIdx],
          procedureId: procId,
          date: fmtDate(apptDate),
          startTime: appt.start,
          endTime,
          status: appt.status,
          professionalId: profissionalId,
        })
        .returning();

      if (appt.status === "concluido") {
        const [patient] = await db
          .select({ name: patientsTable.name })
          .from(patientsTable)
          .where(eq(patientsTable.id, patientIds[patIdx]));

        await db.insert(financialRecordsTable).values({
          type: "receita",
          amount: String(proc.price),
          description: `${proc.name} - ${patient?.name ?? "Paciente"}`,
          category: proc.category,
          appointmentId: appointment.id,
        });
      }
    }
    console.log(`  ✅ ${appointments.length} agendamentos criados`);

    console.log("💰 Criando despesas de exemplo...");
    const expenses = [
      { description: "Aluguel do consultório", amount: "3500.00", category: "fixo" },
      { description: "Materiais de fisioterapia", amount: "450.00", category: "materiais" },
      { description: "Plano de saúde da equipe", amount: "800.00", category: "pessoal" },
      { description: "Software de gestão", amount: "199.00", category: "tecnologia" },
      { description: "Conta de luz", amount: "380.00", category: "fixo" },
      { description: "Produtos para estética", amount: "620.00", category: "materiais" },
      { description: "Marketing digital", amount: "500.00", category: "marketing" },
    ];

    for (const exp of expenses) {
      await db.insert(financialRecordsTable).values({
        type: "despesa",
        amount: exp.amount,
        description: exp.description,
        category: exp.category,
      });
    }
    console.log(`  ✅ ${expenses.length} despesas criadas`);
  }

  console.log("\n✅ Seed concluído com sucesso!");
  console.log("\n🔑 Credenciais de acesso:");
  for (const u of DEMO_USERS) {
    console.log(`   ${u.email} / ${u.password}  → [${u.roles.join(", ")}]`);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Erro no seed:", err);
    process.exit(1);
  });
