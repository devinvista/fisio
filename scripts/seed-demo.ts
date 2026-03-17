import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../db/schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// ─── Date helpers ────────────────────────────────────────────────────────────

function d(iso: string) { return iso; }

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Iniciando seed de demonstração 2026...\n");

  // ── 1. Admin user ──────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("admin123", 10);
  await db.insert(schema.usersTable).values({
    name: "Dr. Rafael Oliveira",
    email: "admin@fisiogest.com",
    passwordHash,
    role: "admin",
  }).onConflictDoNothing();
  console.log("✓ Usuário admin: admin@fisiogest.com / admin123");

  // ── 2. Procedures ──────────────────────────────────────────────────────────
  const procRows = await db.insert(schema.proceduresTable).values([
    { name: "Fisioterapia",            category: "fisioterapia", durationMinutes: 50, price: "80.00",  cost: "15.00", description: "Sessão de fisioterapia ortopédica/neurológica" },
    { name: "Massagem Terapêutica",    category: "estetica",     durationMinutes: 60, price: "80.00",  cost: "12.00", description: "Massagem relaxante e terapêutica" },
    { name: "Drenagem Linfática",      category: "estetica",     durationMinutes: 60, price: "80.00",  cost: "10.00", description: "Drenagem linfática manual" },
    { name: "Limpeza de Pele",         category: "estetica",     durationMinutes: 75, price: "150.00", cost: "25.00", description: "Limpeza de pele profunda" },
    { name: "Peeling de Diamante",     category: "estetica",     durationMinutes: 45, price: "120.00", cost: "20.00", description: "Microdermoabrasão com ponta de diamante" },
    { name: "Peeling Químico",         category: "estetica",     durationMinutes: 45, price: "120.00", cost: "22.00", description: "Peeling com ácidos dermatológicos" },
    { name: "Carboxiterapia Corporal", category: "estetica",     durationMinutes: 45, price: "120.00", cost: "18.00", description: "Aplicação de CO₂ para estética corporal" },
    { name: "Carboxiterapia Capilar",  category: "estetica",     durationMinutes: 40, price: "90.00",  cost: "15.00", description: "Tratamento capilar com CO₂" },
    { name: "Radiofrequência",         category: "estetica",     durationMinutes: 50, price: "180.00", cost: "30.00", description: "Radiofrequência para flacidez e celulite" },
    { name: "Escleroterapia",          category: "fisioterapia", durationMinutes: 40, price: "180.00", cost: "40.00", description: "Tratamento de varizes e vasinhos" },
  ]).returning();
  console.log(`✓ ${procRows.length} procedimentos criados`);

  const proc = Object.fromEntries(procRows.map(p => [p.name, p]));

  // ── 3. Patients ────────────────────────────────────────────────────────────
  const patientRows = await db.insert(schema.patientsTable).values([
    // ★ PRINCIPAL — Gabriela (paciente principal detalhada)
    {
      name: "Gabriela Mendonça Ferreira",
      cpf: "123.456.789-09",
      birthDate: "1988-06-15",
      phone: "(11) 98765-4321",
      email: "gabriela.ferreira@email.com",
      address: "Rua das Acácias, 350 – Apt 82 – Pinheiros, São Paulo",
      profession: "Jornalista",
      emergencyContact: "Carlos Ferreira (marido) — (11) 97654-3210",
      notes: "Dor lombar crônica + celulite grau III. Sedentária. Hérnia L4-L5 sem indicação cirúrgica. Alergia a dipirona.",
    },
    // Pacientes adicionais
    {
      name: "Roberta Alves Pinto",
      cpf: "987.654.321-00",
      birthDate: "1979-03-22",
      phone: "(11) 91234-5678",
      email: "roberta.pinto@email.com",
      address: "Av. Rebouças, 1200 – São Paulo",
      profession: "Empresária",
      emergencyContact: "Marcos Pinto — (11) 99876-5432",
      notes: "Pós-operatório de LCA (ligamento cruzado anterior)",
    },
    {
      name: "Thiago Lessa Carvalho",
      cpf: "456.789.123-55",
      birthDate: "1995-11-08",
      phone: "(11) 94567-8901",
      email: "thiago.lessa@email.com",
      profession: "Estudante de Educação Física",
      notes: "Tendinite patelar bilateral. Atleta amador de vôlei.",
    },
    {
      name: "Sônia Maria Barros",
      cpf: "321.654.987-11",
      birthDate: "1962-07-30",
      phone: "(11) 93210-9876",
      email: "sonia.barros@email.com",
      address: "Rua Frei Caneca, 600 – São Paulo",
      profession: "Aposentada",
      emergencyContact: "Paulo Barros (filho) — (11) 91111-2222",
      notes: "Osteoartrite de joelho. Hipertensa controlada.",
    },
    {
      name: "Felipe Monteiro Dias",
      cpf: "654.321.098-77",
      birthDate: "1990-01-14",
      phone: "(11) 96543-2109",
      email: "felipe.dias@email.com",
      profession: "Analista de TI",
      notes: "LER/DORT. Síndrome do túnel do carpo bilateral.",
    },
  ]).returning();
  console.log(`✓ ${patientRows.length} pacientes criados`);

  const [gabi, roberta, thiago, sonia, felipe] = patientRows;
  const fisioProcId  = proc["Fisioterapia"].id;
  const drenagemId   = proc["Drenagem Linfática"].id;
  const radiofreqId  = proc["Radiofrequência"].id;
  const carboxId     = proc["Carboxiterapia Corporal"].id;
  const massagemId   = proc["Massagem Terapêutica"].id;
  const peelingDiamId = proc["Peeling de Diamante"].id;

  // ── 4. Appointments — Gabriela (main patient, full 2026 timeline) ──────────
  //
  // Schema: Fisio 2× sem (ter/qui 08:00) + estética variada (qui 10:00)
  // Jan 7 → hoje (17/mar), depois agendados até 26/mar
  //
  type ApptInput = {
    patientId: number;
    procedureId: number;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    notes?: string;
  };

  const gabiAppts: ApptInput[] = [
    // ── Janeiro ──────────────────────────────────────────────────────────────
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-01-06", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "Avaliação inicial. Testes de mobilidade lombar." },
    { patientId: gabi.id, procedureId: drenagemId,   date: "2026-01-08", startTime: "10:00", endTime: "11:00", status: "concluido", notes: "1ª sessão de drenagem linfática." },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-01-13", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "Exercícios de estabilização lombar. Pilates terapêutico." },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-01-15", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "Melhora na flexão anterior. Alongamento de isquiotibiais." },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-01-20", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "Introdução de exercícios de fortalecimento do core." },
    { patientId: gabi.id, procedureId: drenagemId,   date: "2026-01-22", startTime: "10:00", endTime: "11:00", status: "concluido", notes: "2ª sessão de drenagem. Paciente referiu leveza nas pernas." },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-01-27", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "EVA 5/10. Progresso satisfatório." },
    { patientId: gabi.id, procedureId: radiofreqId,  date: "2026-01-29", startTime: "10:00", endTime: "11:00", status: "concluido", notes: "1ª sessão de radiofrequência — foco em coxas e glúteos." },
    // ── Fevereiro ─────────────────────────────────────────────────────────────
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-02-03", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "Introdução de agachamento com apoio. Dor EVA 4/10." },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-02-05", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "RPG. Trabalho postural em espelho. EVA 3/10." },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-02-10", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "Exercícios de ponte e prancha. Tolerância boa." },
    { patientId: gabi.id, procedureId: drenagemId,   date: "2026-02-12", startTime: "10:00", endTime: "11:00", status: "concluido", notes: "3ª sessão drenagem. Redução de 1,5 cm na coxa esquerda." },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-02-17", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "Aumento de carga nos exercícios. EVA 2/10 — grande melhora." },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-02-19", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "Treino funcional leve. Paciente relata dormir melhor." },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-02-24", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "Revisão de postura no ambiente de trabalho (home office)." },
    { patientId: gabi.id, procedureId: carboxId,     date: "2026-02-26", startTime: "10:00", endTime: "11:00", status: "concluido", notes: "1ª sessão carboxiterapia corporal — coxa e abdome." },
    // ── Março ─────────────────────────────────────────────────────────────────
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-03-03", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "Retorno pós carnaval. Manutenção dos ganhos." },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-03-05", startTime: "08:00", endTime: "09:00", status: "cancelado", notes: "Paciente cancelou — compromisso profissional." },
    { patientId: gabi.id, procedureId: drenagemId,   date: "2026-03-10", startTime: "10:00", endTime: "11:00", status: "concluido", notes: "4ª sessão drenagem. Resultados visíveis." },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-03-12", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "EVA 1/10. Paciente refere alta funcionalidade. Próxima fase." },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-03-17", startTime: "08:00", endTime: "09:00", status: "concluido", notes: "Sessão de hoje — manutenção e exercícios domiciliares." },
    // ── Agendados (futuro) ────────────────────────────────────────────────────
    { patientId: gabi.id, procedureId: radiofreqId,  date: "2026-03-19", startTime: "10:00", endTime: "11:00", status: "agendado" },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-03-24", startTime: "08:00", endTime: "09:00", status: "agendado" },
    { patientId: gabi.id, procedureId: carboxId,     date: "2026-03-26", startTime: "10:00", endTime: "11:00", status: "agendado" },
    { patientId: gabi.id, procedureId: fisioProcId,  date: "2026-03-31", startTime: "08:00", endTime: "09:00", status: "agendado" },
  ];

  // ── Appointments — outros pacientes ────────────────────────────────────────
  const otherAppts: ApptInput[] = [
    // Roberta — pós-LCA, fisioterapia 3x/semana jan-mar
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-01-05", startTime: "09:00", endTime: "10:00", status: "concluido" },
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-01-07", startTime: "09:00", endTime: "10:00", status: "concluido" },
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-01-09", startTime: "09:00", endTime: "10:00", status: "concluido" },
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-01-14", startTime: "09:00", endTime: "10:00", status: "concluido" },
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-01-16", startTime: "09:00", endTime: "10:00", status: "concluido" },
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-01-21", startTime: "09:00", endTime: "10:00", status: "concluido" },
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-01-28", startTime: "09:00", endTime: "10:00", status: "concluido" },
    { patientId: roberta.id, procedureId: massagemId,  date: "2026-02-04", startTime: "09:00", endTime: "10:00", status: "concluido" },
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-02-11", startTime: "09:00", endTime: "10:00", status: "concluido" },
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-02-18", startTime: "09:00", endTime: "10:00", status: "concluido" },
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-02-25", startTime: "09:00", endTime: "10:00", status: "concluido" },
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-03-04", startTime: "09:00", endTime: "10:00", status: "concluido" },
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-03-11", startTime: "09:00", endTime: "10:00", status: "concluido" },
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-03-18", startTime: "09:00", endTime: "10:00", status: "agendado" },
    { patientId: roberta.id, procedureId: fisioProcId, date: "2026-03-25", startTime: "09:00", endTime: "10:00", status: "agendado" },
    // Thiago — tendinite patelar, fisio + massagem
    { patientId: thiago.id, procedureId: fisioProcId,  date: "2026-02-03", startTime: "11:00", endTime: "12:00", status: "concluido" },
    { patientId: thiago.id, procedureId: fisioProcId,  date: "2026-02-10", startTime: "11:00", endTime: "12:00", status: "concluido" },
    { patientId: thiago.id, procedureId: massagemId,   date: "2026-02-17", startTime: "11:00", endTime: "12:00", status: "concluido" },
    { patientId: thiago.id, procedureId: fisioProcId,  date: "2026-02-24", startTime: "11:00", endTime: "12:00", status: "concluido" },
    { patientId: thiago.id, procedureId: fisioProcId,  date: "2026-03-03", startTime: "11:00", endTime: "12:00", status: "concluido" },
    { patientId: thiago.id, procedureId: fisioProcId,  date: "2026-03-10", startTime: "11:00", endTime: "12:00", status: "faltou"   },
    { patientId: thiago.id, procedureId: fisioProcId,  date: "2026-03-17", startTime: "11:00", endTime: "12:00", status: "agendado" },
    { patientId: thiago.id, procedureId: fisioProcId,  date: "2026-03-24", startTime: "11:00", endTime: "12:00", status: "agendado" },
    // Sônia — osteoartrite, fisio + drenagem mensal
    { patientId: sonia.id,  procedureId: fisioProcId,  date: "2026-01-06", startTime: "14:00", endTime: "15:00", status: "concluido" },
    { patientId: sonia.id,  procedureId: fisioProcId,  date: "2026-01-13", startTime: "14:00", endTime: "15:00", status: "concluido" },
    { patientId: sonia.id,  procedureId: drenagemId,   date: "2026-01-20", startTime: "14:00", endTime: "15:00", status: "concluido" },
    { patientId: sonia.id,  procedureId: fisioProcId,  date: "2026-01-27", startTime: "14:00", endTime: "15:00", status: "concluido" },
    { patientId: sonia.id,  procedureId: fisioProcId,  date: "2026-02-03", startTime: "14:00", endTime: "15:00", status: "concluido" },
    { patientId: sonia.id,  procedureId: fisioProcId,  date: "2026-02-17", startTime: "14:00", endTime: "15:00", status: "concluido" },
    { patientId: sonia.id,  procedureId: drenagemId,   date: "2026-02-24", startTime: "14:00", endTime: "15:00", status: "concluido" },
    { patientId: sonia.id,  procedureId: fisioProcId,  date: "2026-03-03", startTime: "14:00", endTime: "15:00", status: "concluido" },
    { patientId: sonia.id,  procedureId: fisioProcId,  date: "2026-03-10", startTime: "14:00", endTime: "15:00", status: "concluido" },
    { patientId: sonia.id,  procedureId: fisioProcId,  date: "2026-03-17", startTime: "14:00", endTime: "15:00", status: "confirmado" },
    { patientId: sonia.id,  procedureId: fisioProcId,  date: "2026-03-24", startTime: "14:00", endTime: "15:00", status: "agendado"  },
    // Felipe — LER/DORT, fisio + massagem
    { patientId: felipe.id, procedureId: fisioProcId,  date: "2026-03-02", startTime: "16:00", endTime: "17:00", status: "concluido" },
    { patientId: felipe.id, procedureId: massagemId,   date: "2026-03-09", startTime: "16:00", endTime: "17:00", status: "concluido" },
    { patientId: felipe.id, procedureId: fisioProcId,  date: "2026-03-16", startTime: "16:00", endTime: "17:00", status: "concluido" },
    { patientId: felipe.id, procedureId: fisioProcId,  date: "2026-03-23", startTime: "16:00", endTime: "17:00", status: "agendado"  },
    { patientId: felipe.id, procedureId: fisioProcId,  date: "2026-03-30", startTime: "16:00", endTime: "17:00", status: "agendado"  },
  ];

  const allAppts = [...gabiAppts, ...otherAppts];
  const appointments = await db.insert(schema.appointmentsTable).values(allAppts).returning();
  console.log(`✓ ${appointments.length} agendamentos criados`);

  // ── Retrieve Gabriela's appointments in order ────────────────────────────
  const gabiApptsDb = appointments.filter(a => a.patientId === gabi.id && a.status === "concluido");

  // ── 5. Anamnese — Gabriela ─────────────────────────────────────────────────
  await db.insert(schema.anamnesisTable).values({
    patientId: gabi.id,
    mainComplaint: "Dor lombar de forte intensidade (EVA 7/10) que piora com posição sentada prolongada e ao se levantar da cama pela manhã. Há relato de irradiação para glúteo esquerdo. Queixa estética secundária: celulite grau III em coxas e glúteos.",
    diseaseHistory: "Lombalgia crônica há aproximadamente 7 anos, com piora progressiva após início do home office em 2020. RM de coluna lombar (set/2024) evidenciou hérnia discal L4-L5 com protrusão postero-lateral esquerda, sem sinais de compressão radicular cirúrgica. Já realizou 2 ciclos de fisioterapia anteriores (2021 e 2023) com melhora parcial.",
    medicalHistory: "Sem cirurgias prévias. Fratura de punho direito em 2015 (consolidada). Hérnia discal L4-L5 (diagnosticada 2024). Nenhuma internação hospitalar.",
    medications: "Ibuprofeno 400mg SOS (uso eventual). Método contraceptivo oral (Yasmin). Suplementação: ômega-3 e colágeno hidrolisado.",
    allergies: "Dipirona sódica (intolerância — náuseas). Sulfamídicos (erupção cutânea).",
    familyHistory: "Mãe: lombalgia crônica e osteoporose. Pai: hipertensão arterial. Avó materna: artrose de quadril bilateral.",
    lifestyle: "Trabalha em home office ~8h/dia na posição sentada. Sedentária — sem atividade física regular antes do tratamento. Dorme 6-7h/noite, qualidade autorreferida como ruim. Alimentação equilibrada, não fuma, consumo eventual de vinho nos finais de semana.",
    painScale: 7,
  });
  console.log("✓ Anamnese de Gabriela criada");

  // ── 6. Avaliação Fisioterapêutica — Gabriela ──────────────────────────────
  await db.insert(schema.evaluationsTable).values({
    patientId: gabi.id,
    inspection: "Paciente em bom estado geral. Postura global com anteriorização de cabeça (3 cm além da linha de prumo), ombros em protração bilateral. Hiperlordose lombar acentuada. Joelhos em valgo discreto. Pé plano bilateral. Marcha dentro dos padrões, sem antalgias.",
    posture: "Vista anterior: ombros levemente elevados à esquerda. Vista posterior: escoliose funcional à esquerda em região torácica (não estrutural). Vista lateral: acentuação de todas as curvaturas fisiológicas, especialmente lordose lombar.",
    rangeOfMotion: "Flexão anterior lombar: 45° (limitada — dor EVA 6/10 no final do movimento). Extensão: 20° (limitada). Inclinação lateral D: 25°, E: 20° (assimetria). Rotação sem limitação significativa. Teste de Schober positivo (4 cm de expansão vs. 5+ esperado).",
    muscleStrength: "Grau 3+/5 para extensores de quadril. Grau 4/5 para glúteo médio bilateral. Abdominais profundos (transverso): grau 2/5 — ativação deficiente. MMII: força preservada.",
    orthopedicTests: "Lasègue negativo bilateralmente. Teste de Patrick (FABER) positivo à esquerda (dor no quadril). Teste de Slump negativo. Palpação: hipertonia de paravertebrais lombares, especialmente erector spinae L3-L5 esquerda. Trigger points em piriforme esquerdo.",
    functionalDiagnosis: "Síndrome álgica lombar crônica secundária à hérnia discal L4-L5, associada a instabilidade do core, hiperlordose lombar e encurtamento de isquiotibiais e flexores de quadril. Tratamento indicado: estabilização segmentar, fortalecimento de core e glúteos, alongamento de cadeia posterior, reeducação postural.",
  });
  console.log("✓ Avaliação fisioterapêutica criada");

  // ── 7. Plano de tratamento — Gabriela ────────────────────────────────────
  await db.insert(schema.treatmentPlansTable).values({
    patientId: gabi.id,
    objectives: "1) Reduzir dor lombar para EVA ≤ 2/10 em 3 meses\n2) Fortalecer musculatura do core (transverso abdominal, multífidos, glúteos)\n3) Melhorar amplitude de movimento lombar e flexibility de isquiotibiais\n4) Reeducar postura para trabalho em home office\n5) Melhora estética: redução de celulite grau III com tratamentos combinados",
    techniques: "Fisioterapia: estabilização segmentar lombar (Método McKenzie + motor control), fortalecimento de glúteo médio e máximo, alongamento de cadeia posterior, TENS lombar SOS, RPG.\n\nEstética: drenagem linfática manual (método Vodder), radiofrequência multipolar, carboxiterapia corporal (flancos, coxas e glúteos).",
    frequency: "Fisioterapia: 2× por semana (terças e quintas, 08h). Estética: 1× por semana (quintas, 10h), alternando drenagem/radiofrequência/carboxiterapia.",
    estimatedSessions: 24,
    status: "ativo",
  });
  console.log("✓ Plano de tratamento criado");

  // ── 8. Evoluções — Gabriela (por sessão concluída de fisioterapia) ─────────
  const fisioSessions = gabiApptsDb.filter(a => a.procedureId === fisioProcId);

  const evoNotes = [
    {
      description: "Avaliação inicial detalhada. Aplicação de TENS lombar (frequência 100Hz, 20min). Orientações posturais para home office. Exercícios: respiração diafragmática, contração isométrica de transverso.",
      patientResponse: "Paciente receptiva e motivada. Referiu leve alívio após TENS. EVA pós-sessão: 6/10.",
      clinicalNotes: "Início de protocolo de estabilização segmentar. Déficit importante de motor control lombar confirmado.",
      complications: null,
    },
    {
      description: "Continuação estabilização segmentar. Exercícios: ponte, bird-dog 3×10, agachamento isométrico na parede. TENS 20min.",
      patientResponse: "Boa tolerância aos exercícios. Refere dificuldade em ativar transverso de forma isolada. EVA: 6/10.",
      clinicalNotes: "Feedback tátil no abdome para facilitação da contração do transverso.",
      complications: null,
    },
    {
      description: "Progressão: introdução de exercícios de ponte com elevação unipodal. Alongamento de isquiotibiais (ativo assistido). RPG — posição de andador.",
      patientResponse: "Paciente relata melhora subjetiva ao se levantar pela manhã. EVA: 5/10.",
      clinicalNotes: "Boa evolução na ativação glútea. Manter progressão semanal.",
      complications: null,
    },
    {
      description: "4ª sessão fisio. Prancha frontal (3×20s), side plank bilateral. Liberação miofascial de piriforme com foam roller.",
      patientResponse: "Referiu dor ao realizar side plank esquerdo. Adaptação com apoio no joelho. EVA: 4/10.",
      clinicalNotes: "Possível irritação de SI esquerda. Observar próximas sessões.",
      complications: "Dor leve em side plank esquerdo — adaptação técnica.",
    },
    {
      description: "5ª sessão. Revisão de postura sentada. Ergonomia do posto de trabalho via fotos da paciente. Exercícios: mini agachamento com theraband, cadeia cinética fechada.",
      patientResponse: "Muito receptiva às orientações de ergonomia. EVA: 4/10.",
      clinicalNotes: "Orientações específicas para regulagem de cadeira e monitor. Material entregue.",
      complications: null,
    },
    {
      description: "6ª sessão. Progressão de carga: agachamento bilateral com 2kg. Dead bug 3×12. TENS pulsado em paravertebrais.",
      patientResponse: "Paciente relata dormir melhor nos últimos 5 dias. EVA: 3/10. Melhora significativa.",
      clinicalNotes: "Sinal de melhora consistente. Redução de hipertonia paravertebral à palpação.",
      complications: null,
    },
    {
      description: "7ª sessão. Iniciado treino funcional: subida e descida de degrau com controle. Fortalecimento de glúteo médio com faixa elástica (nível médio).",
      patientResponse: "Muito animada com a evolução. Está incorporando caminhadas de 20min/dia. EVA: 2/10.",
      clinicalNotes: "Evolução excelente! Motor control lombar muito melhorado. Planejar alta progressiva.",
      complications: null,
    },
    {
      description: "8ª sessão. Revisão de todos os exercícios do programa domiciliar. Treino de propriocepção em superfície instável.",
      patientResponse: "Refere retorno das atividades domésticas sem limitações. EVA: 2/10.",
      clinicalNotes: "Manutenção e prevenção de recidivas. Orientar sobre sinais de alerta.",
      complications: null,
    },
    {
      description: "9ª sessão. Avaliação de reavaliação funcional. Teste de Schober: 5,5cm (melhora de 1,5cm). Flexão anterior: 65° sem dor.",
      patientResponse: "Paciente muito satisfeita com os resultados funcionais e estéticos. EVA: 1/10.",
      clinicalNotes: "Reavaliação demonstra evolução excelente. Manter frequência atual por mais 3 sessões e reavaliar necessidade de alta.",
      complications: null,
    },
    {
      description: "10ª sessão. Manutenção funcional. Treino de estabilidade avançado. Programa de exercícios domiciliares revisado e entregue em formato digital.",
      patientResponse: "Sem dor em repouso. Dor 1/10 apenas em esforços intensos. Satisfação máxima com o tratamento.",
      clinicalNotes: "Paciente atingiu 90% dos objetivos do plano de tratamento. Próximas 2 sessões de manutenção e considerar alta.",
      complications: null,
    },
  ];

  const evoValues = fisioSessions.slice(0, evoNotes.length).map((appt, idx) => ({
    patientId: gabi.id,
    appointmentId: appt.id,
    description: evoNotes[idx].description,
    patientResponse: evoNotes[idx].patientResponse,
    clinicalNotes: evoNotes[idx].clinicalNotes,
    complications: evoNotes[idx].complications ?? undefined,
  }));

  await db.insert(schema.evolutionsTable).values(evoValues);
  console.log(`✓ ${evoValues.length} evoluções de Gabriela criadas`);

  // ── 9. Financial records — all completed appointments ──────────────────────
  const financialValues: schema.InsertFinancialRecord[] = [];

  for (const appt of appointments) {
    if (appt.status !== "concluido") continue;
    const procInfo = procRows.find(p => p.id === appt.procedureId);
    const patient  = patientRows.find(p => p.id === appt.patientId);
    if (!procInfo) continue;
    financialValues.push({
      type: "receita",
      amount: procInfo.price,
      description: `${procInfo.name} — ${patient?.name ?? "Paciente"}`,
      category: procInfo.category,
      appointmentId: appt.id,
      patientId: appt.patientId,
    });
  }

  // Monthly clinic expenses (jan, fev, mar)
  const monthlyExpenses = [
    { description: "Aluguel da clínica",           amount: "3800.00", category: "fixo"        },
    { description: "Energia elétrica",              amount: "310.00",  category: "fixo"        },
    { description: "Internet e telefone",           amount: "170.00",  category: "fixo"        },
    { description: "Material de consumo clínico",  amount: "480.00",  category: "consumo"     },
    { description: "Produtos estéticos",            amount: "650.00",  category: "consumo"     },
    { description: "Software FisioGest Pro",        amount: "99.00",   category: "sistema"     },
    { description: "Marketing digital / Instagram", amount: "400.00",  category: "marketing"   },
    { description: "Manutenção de equipamentos",   amount: "220.00",  category: "equipamento" },
    { description: "Limpeza e higiene",             amount: "200.00",  category: "fixo"        },
    { description: "Contador",                      amount: "350.00",  category: "fixo"        },
  ];

  for (let m = 0; m < 3; m++) {
    for (const exp of monthlyExpenses) {
      financialValues.push({ type: "despesa", amount: exp.amount, description: exp.description, category: exp.category });
    }
  }

  if (financialValues.length > 0) {
    const inserted = await db.insert(schema.financialRecordsTable).values(financialValues).returning();
    console.log(`✓ ${inserted.length} registros financeiros criados`);
  }

  // ── 10. Summary ───────────────────────────────────────────────────────────
  console.log("\n✅ Seed de demonstração 2026 concluído!");
  console.log("─────────────────────────────────────────");
  console.log("🔑 Login: admin@fisiogest.com / admin123");
  console.log("👤 Paciente principal: Gabriela Mendonça Ferreira");
  console.log("   ↳ 10 procedimentos | 5 pacientes | histórico jan–mar/2026");
  console.log("─────────────────────────────────────────\n");

  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
