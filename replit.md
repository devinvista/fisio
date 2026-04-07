# FisioGest Pro

## Visão Geral

FisioGest Pro é uma plataforma SaaS de gestão clínica completa para fisioterapeutas, estetas e instrutores de pilates. Abrange prontuário eletrônico, agenda, financeiro, relatórios e conformidade com normas do COFFITO.

### Landing Page & Rotas Públicas
- `/` → Landing page pública (`artifacts/fisiogest/src/pages/landing.tsx`) — hero dark, features, pricing, testimonials, CTA
- `/login` → Login
- `/register` → Cadastro
- `/dashboard` → Dashboard protegido (rota principal pós-login, movida de `/`)
- Após login bem-sucedido: redireciona para `/dashboard` (atualizado em `auth-context.tsx`)

O projeto é um **monorepo pnpm** hospedado no Replit. Dividido em dois artefatos (frontend + API) servidos pelo proxy reverso compartilhado do Replit na porta 80.

**Idioma padrão**: Português do Brasil (pt-BR)
**Moeda**: Real Brasileiro (BRL — R$)
**Medidas**: Sistema Internacional (SI) — kg, cm, °C
**Formato de data**: dd/MM/yyyy (ex.: 18/03/2026)
**Formato de hora**: HH:mm — 24 horas (ex.: 14:30)
**Separador decimal**: vírgula (ex.: R$ 1.250,00)
**Separador de milhar**: ponto (ex.: 1.250)
**Fuso horário padrão**: America/Sao_Paulo (UTC-3 / UTC-2 no horário de verão)

> **Importante (backend):** Nunca usar `new Date().toISOString()` ou `new Date().getMonth()` para cálculos de negócio. Sempre usar as funções em `artifacts/api-server/src/lib/dateUtils.ts`:
> - `todayBRT()` → string "YYYY-MM-DD" no fuso de Brasília
> - `nowBRT()` → `{ year, month, day }` no fuso de Brasília
> - `monthDateRangeBRT(year, month)` → `{ startDate, endDate }` de um mês

---

## Stack Técnica

- **Node.js**: 22 (requer 20+ para o Vite 7)
- **Gerenciador de pacotes**: pnpm 10.26 (workspace)
- **TypeScript**: 5.9
- **Frontend** (`artifacts/fisiogest`): React 19 + Vite 7 + TailwindCSS v4 + shadcn/ui (new-york)
- **Backend** (`artifacts/api-server`): Express 5
- **Banco de dados**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Validação**: Zod v4, drizzle-zod (`lib/api-zod`)
- **API client**: hooks React Query gerados pelo Orval (`lib/api-client-react`)
- **Autenticação**: JWT (jsonwebtoken) + bcryptjs
- **Autorização**: RBAC com tabelas `user_roles`, `roles_permissions`; roles: admin, profissional, secretaria
- **Gráficos**: Recharts
- **Ícones**: Lucide React

---

## Padrões de Localização (pt-BR)

| Contexto | Padrão | Exemplo |
|---|---|---|
| Idioma do HTML | `lang="pt-BR"` | `<html lang="pt-BR">` |
| Formatação de datas | `date-fns/locale/ptBR` | `dd/MM/yyyy` |
| Calendário | `locale="pt-BR"` | mês curto: "jan", "fev"... |
| Moeda | `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })` | R$ 1.250,00 |
| Números | `toLocaleString("pt-BR")` | 1.250,5 |
| Peso | quilogramas (kg) | 72 kg |
| Altura | centímetros (cm) | 175 cm |
| Temperatura corporal | graus Celsius (°C) | 36,5 °C |
| Pressão arterial | mmHg | 120/80 mmHg |
| Dor (escala EVA) | 0–10 | EVA 7/10 |

---

## Deploy no Hostinger

O projeto está pronto para deploy no **Node.js Hosting** da Hostinger com as configurações abaixo.

### Configurações do painel Hostinger

| Campo | Valor |
|---|---|
| Node.js version | **22.x** |
| Package manager | **pnpm** |
| Build command | `pnpm install && pnpm run build` |
| Start command | `node dist/server.cjs` |
| Entry point | `dist/server.cjs` |

### Variáveis de ambiente obrigatórias

Configurar no painel Hostinger → **Environment Variables**:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão PostgreSQL (ex.: `postgresql://user:pass@host:5432/db`) |
| `JWT_SECRET` | Chave secreta longa e aleatória (ex.: gere com `openssl rand -base64 64`) |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | URL do domínio (ex.: `https://fisiogest.seudominio.com`) |

> **JWT_SECRET é obrigatório**: o servidor recusa iniciar em produção sem essa variável.

### Fluxo de build

```
pnpm install                    # instala todas as dependências
pnpm run build
  ├── vite build                # compila o frontend → dist/public/
  └── tsx server/build.ts       # empacota o backend  → dist/server.cjs
                                #                     + copia dist/migrations/
node dist/server.cjs            # inicia o servidor (aplica migrations automaticamente)
```

### Migrações

As migrations SQL ficam em `db/migrations/` (geradas com `pnpm run db:generate`). O servidor as aplica automaticamente na inicialização via `drizzle-orm/migrator`. Em um banco já existente (sem journal de migrations), a aplicação ignora tabelas já criadas com segurança.

---

## Arquitetura Replit — IMPORTANTE

O Replit usa um **proxy reverso compartilhado na porta 80** para rotear tráfego entre serviços.

| Serviço | Filtro do pacote | Porta local | Caminho proxy |
|---|---|---|---|
| Frontend | `@workspace/fisiogest` | **20408** | `/` |
| API Server | `@workspace/api-server` | **8080** | `/api` |

> **Nunca execute o layout raiz (`src/` + `server/`) no Replit.** Esses arquivos existem apenas para hospedagem externa (ex.: Hostinger/Railway/Render).

### Workflows (artifact-based)

Os serviços são iniciados por workflows individuais gerenciados pelo Replit:
- `artifacts/api-server: API Server` → porta 8080
- `artifacts/fisiogest: web` → porta 20408

> Não use o workflow manual `Start application` — ele conflita com os workflows de artefato acima.

### Fluxo de requisições em desenvolvimento

```
Browser → https://<repl>.replit.dev/
  ├── /api/*  → Proxy Replit → localhost:8080  (api-server)
  └── /*      → Proxy Replit → localhost:20408 (fisiogest Vite dev server)
                  └── /api/* (proxy Vite) → localhost:8080
```

---

## Estrutura do Projeto

```text
/
├── artifacts/
│   ├── fisiogest/                      # Frontend React (@workspace/fisiogest)
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── index.css               # Tema TailwindCSS v4 — primary: teal 180°
│   │   │   ├── pages/
│   │   │   │   ├── login.tsx
│   │   │   │   ├── register.tsx
│   │   │   │   ├── dashboard.tsx
│   │   │   │   ├── agenda.tsx
│   │   │   │   ├── procedimentos.tsx
│   │   │   │   ├── relatorios.tsx
│   │   │   │   ├── patients/
│   │   │   │   │   ├── index.tsx       # Lista de pacientes + busca
│   │   │   │   │   └── [id].tsx        # Prontuário completo (abas)
│   │   │   │   └── financial/
│   │   │   │       └── index.tsx
│   │   │   ├── components/
│   │   │   │   ├── layout/app-layout.tsx
│   │   │   │   ├── logo-mark.tsx       # SVG logo da marca
│   │   │   │   └── ui/                 # Componentes shadcn/ui
│   │   │   └── lib/
│   │   │       └── auth-context.tsx
│   │   ├── index.html                  # lang="pt-BR"
│   │   └── vite.config.ts
│   │
│   ├── api-server/                     # API Express (@workspace/api-server)
│   │   └── src/
│   │       ├── index.ts
│   │       ├── app.ts
│   │       ├── middleware/auth.ts
│   │       └── routes/
│   │           ├── auth.ts
│   │           ├── patients.ts
│   │           ├── procedures.ts       # CRUD + maxCapacity
│   │           ├── appointments.ts     # Governança de horários + available-slots
│   │           ├── medical-records.ts
│   │           ├── financial.ts
│   │           ├── reports.ts
│   │           └── dashboard.ts
│   │
│   └── mockup-sandbox/                 # Sandbox de prototipagem de UI
│
├── lib/
│   ├── db/                             # @workspace/db — Drizzle ORM + schema
│   │   ├── src/schema/
│   │   │   ├── patients.ts
│   │   │   ├── appointments.ts
│   │   │   ├── procedures.ts           # Campo maxCapacity (vagas simultâneas)
│   │   │   ├── medical-records.ts
│   │   │   ├── financial.ts
│   │   │   └── users.ts
│   │   └── drizzle.config.ts
│   ├── api-zod/
│   ├── api-client-react/
│   └── api-spec/
│
├── src/                                # [SOMENTE HOSPEDAGEM EXTERNA]
├── server/                             # [SOMENTE HOSPEDAGEM EXTERNA]
├── db/                                 # [SOMENTE HOSPEDAGEM EXTERNA]
├── scripts/
│   ├── post-merge.sh
│   ├── seed-demo.ts                    # Seed completo (novo clinic) — falha se usuários já existem
│   └── seed-financial.ts              # Seed financeiro incremental (usa dados existentes)
│
├── pnpm-workspace.yaml
└── .replit
```

---

## Schema do Banco de Dados

Todas as tabelas estão no PostgreSQL provisionado pelo Replit. O schema canônico fica em `lib/db/src/schema/`.

| Tabela | Campos principais |
|---|---|
| `users` | id, email, passwordHash, name, role |
| `patients` | id, name, cpf (único), birthDate, phone, email, address, profession, emergencyContact, notes |
| `procedures` | id, name, category, durationMinutes, price, cost, **maxCapacity** (default 1) |
| `appointments` | id, patientId, procedureId, date, startTime, **endTime** (calculado), status, notes |
| `anamnesis` | id, patientId (único), mainComplaint, diseaseHistory, medications, painScale… |
| `evaluations` | id, patientId, inspection, posture, rangeOfMotion, muscleStrength, orthopedicTests, functionalDiagnosis |
| `treatment_plans` | id, patientId (múltiplos por paciente), **clinicId** (FK → clinics), objectives, techniques, frequency, estimatedSessions, status |
| `evolutions` | id, patientId, appointmentId (FK opcional), description, patientResponse, clinicalNotes, complications, **painScale** (0–10) |
| `discharge_summaries` | id, patientId (único), dischargeDate, dischargeReason, achievedResults, recommendations |
| `patient_subscriptions` | id, patientId, procedureId, startDate, billingDay, monthlyAmount, status, clinicId, **cancelledAt** (timestamp), **nextBillingDate** (date) |
| `session_credits` | id, patientId, procedureId, quantity, usedQuantity, clinicId, notes |
| `financial_records` | id, type (receita/despesa), amount, description, category, appointmentId?, patientId?, procedureId? (FK → procedures), subscriptionId? |

### Comandos de schema

```bash
# Sincronizar schema (pede confirmação em mudanças destrutivas)
pnpm --filter @workspace/db exec drizzle-kit push --config drizzle.config.ts

# Seed financeiro incremental (criar agendamentos + registros financeiros sem duplicar)
tsx scripts/seed-financial.ts

# Seed completo (somente se a clínica e usuários NÃO existirem — cria novo clinic)
pnpm run db:seed-demo
```

### Estado atual do banco (março/2026)

- Clinic id=3 "Marta Schuch": 34 pacientes, 11 procedimentos globais (clinicId=null), ~600 agendamentos, 232 receitas, 21 despesas (jan–mar 2026)
- Credenciais: `mwschuch@gmail.com` / `123456` (admin+profissional, clinicId=3)
- Credenciais: `admin@fisiogest.com.br` / `123456` (super admin, clinicId=null)

---

## Rotas da API

Todas as rotas exigem `Authorization: Bearer <token>`, exceto `/api/auth/*` e `/api/healthz`.

### Autenticação
| Método | Caminho | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Criar usuário |
| POST | `/api/auth/login` | Retorna JWT |
| GET | `/api/auth/me` | Usuário atual |

### Pacientes
| Método | Caminho | Descrição |
|---|---|---|
| GET | `/api/patients` | Lista com busca + paginação |
| POST | `/api/patients` | Criar |
| GET | `/api/patients/:id` | Detalhe + `totalAppointments` + `totalSpent` |
| PUT | `/api/patients/:id` | Atualizar |
| DELETE | `/api/patients/:id` | Excluir |

### Prontuário (abaixo de `/api/patients/:patientId`)
| Método | Caminho | Descrição |
|---|---|---|
| GET/POST | `/anamnesis` | Upsert anamnese |
| GET/POST | `/evaluations` | Listar / Criar avaliação |
| PUT/DELETE | `/evaluations/:id` | Atualizar / Excluir |
| GET | `/treatment-plans` | Listar todos os planos do paciente |
| POST | `/treatment-plans` | Criar novo plano (com clinicId do paciente) |
| GET/PUT | `/treatment-plans/:planId` | Buscar / Atualizar plano específico |
| DELETE | `/treatment-plans/:planId` | Excluir plano |
| GET/POST | `/treatment-plan` | Compat: upsert do plano ativo mais recente |
| GET/POST | `/evolutions` | Listar / Criar evolução |
| PUT/DELETE | `/evolutions/:id` | Atualizar / Excluir |
| GET/POST | `/discharge-summary` | Upsert alta fisioterapêutica (COFFITO) |
| GET | `/appointments` | Histórico de consultas do paciente |
| GET | `/financial` | Registros financeiros do paciente |

### Agendamentos
| Método | Caminho | Descrição |
|---|---|---|
| GET | `/api/appointments` | Listar (filtros: date, startDate, endDate, patientId, status) |
| POST | `/api/appointments` | Criar — endTime calculado automaticamente |
| GET | `/api/appointments/:id` | Detalhe |
| PUT | `/api/appointments/:id` | Atualizar — recalcula endTime |
| DELETE | `/api/appointments/:id` | Excluir |
| POST | `/api/appointments/:id/complete` | Concluir + gerar registro financeiro |
| GET | `/api/appointments/available-slots` | Horários disponíveis (date, procedureId, clinicStart, clinicEnd) |

### Procedimentos
| Método | Caminho | Descrição |
|---|---|---|
| GET | `/api/procedures` | Listar — LEFT JOIN `procedure_costs` para a clínica; retorna `effectivePrice`, `effectiveTotalCost`, `clinicCost`, `isGlobal` |
| POST | `/api/procedures` | Criar |
| PUT | `/api/procedures/:id` | Atualizar dados base |
| PATCH | `/api/procedures/:id/toggle-active` | Ativar / desativar |
| GET | `/api/procedures/:id/costs` | Obter configuração de custos da clínica |
| PUT | `/api/procedures/:id/costs` | Upsert de custos da clínica (`priceOverride`, `fixedCost`, `variableCost`, `notes`) |
| DELETE | `/api/procedures/:id/costs` | Remover override de custos da clínica |
| DELETE | `/api/procedures/:id` | Excluir (cascade em `procedure_costs`) |

**Custos por clínica (`procedure_costs`):**
- `effectivePrice = priceOverride ?? procedure.price`
- `effectiveTotalCost = fixedCost + variableCost` (se houver config) `?? procedure.cost`
- `applyBillingRules` em `appointments.ts` usa `effectivePrice` ao criar `creditoAReceber`
- Procedimentos globais (`clinicId = null`) podem ter override de preço e custo por clínica

**Custo fixo automático (modelo hora):**
- `GET /api/procedures/overhead-analysis?month=&year=&procedureId=` calcula automaticamente:
  - `totalOverhead` = soma de despesas (`type="despesa"`) do mês na clínica
  - `totalAvailableHours` = soma de horas disponíveis dos schedules ativos (`type="clinic"`) no mês
  - `costPerHour` = `totalOverhead / totalAvailableHours`
  - `fixedCostPerSession` = `costPerHour × (durationMinutes / 60)`
  - `fixedCostAllocatedMonthly` = `costPerHour × totalHoursUsed` (baseado em sessões confirmadas do mês)
- O `fixedCost` em `procedure_costs` é persistido como snapshot do valor calculado no momento do salvamento (usado pelo billing)
- O `variableCost` (materiais, insumos) continua manual

### Financeiro
| Método | Caminho | Descrição |
|---|---|---|
| GET | `/api/financial/dashboard` | KPIs mensais (só conta transactionType=pagamento) |
| GET | `/api/financial/records` | Listar registros (filtros: type, month, year) |
| POST | `/api/financial/records` | Criar registro de despesa/receita manual |
| GET | `/api/financial/patients/:id/history` | Histórico financeiro completo do paciente |
| GET | `/api/financial/patients/:id/summary` | Saldo: totalAReceber, totalPago, saldo, totalSessionCredits |
| POST | `/api/financial/patients/:id/payment` | Registrar pagamento do paciente (transactionType=pagamento) |
| GET | `/api/financial/patients/:id/credits` | Créditos de sessão do paciente |
| GET | `/api/financial/patients/:id/subscriptions` | Assinaturas ativas do paciente |
| PATCH | `/api/financial/records/:id/status` | Atualizar status do registro |
| PATCH | `/api/financial/records/:id/estorno` | Soft-reversal: marca status=estornado (nunca deleta receitas) |
| DELETE | `/api/financial/records/:id` | Deleta despesas; estorna receitas (soft) |

**Modelo financeiro (v2):**
- Sessões agendadas → geram `creditoAReceber` (receita pendente)
- Pagamento do paciente → `transactionType: "pagamento"`, `status: "pago"`
- Saldo = totalAReceber − totalPago
- Receitas NUNCA são hard-deleted — apenas soft-estornadas (status=estornado)
- Types suportados: `creditoAReceber`, `cobrancaSessao`, `cobrancaMensal`, `pagamento`, `usoCredito`, `creditoSessao`, `ajuste`, `estorno`

---

## Regras de Governança de Agendamentos

1. **endTime sempre calculado** — o sistema calcula `endTime = startTime + procedure.durationMinutes`. O cliente nunca envia `endTime`.
2. **Procedimentos com maxCapacity = 1** (padrão) — qualquer sobreposição de horário ativo gera conflito 409.
3. **Procedimentos com maxCapacity > 1** (ex.: Pilates em Grupo = 4) — permite até N agendamentos simultâneos do mesmo procedimento. A 5ª tentativa retorna 409 com a mensagem "Horário lotado: N/N vagas ocupadas".
4. **Endpoint de vagas** — `GET /api/appointments/available-slots?date=&procedureId=&clinicStart=08:00&clinicEnd=18:00` retorna slots a cada 30 min com `available` e `spotsLeft`.
5. **Agendamento recorrente** — `POST /api/appointments/recurring` persiste `clinicId` e `scheduleId` em cada sessão; conflitos são verificados por agenda (scope de `scheduleId`).
6. **Validação de dias úteis** — `available-slots` retorna `{ slots: [], notWorkingDay: true }` quando a data não é dia de funcionamento da agenda. Frontend exibe aviso visual âmbar.
7. **Edição parcial** — `PUT /api/appointments/:id` usa update parcial; `clinicId` e `scheduleId` nunca são sobrescritos por edições de status/notas.

---

## Funcionalidades do Sistema Clínico (Prontuário)

A página do prontuário (`artifacts/fisiogest/src/pages/patients/[id].tsx`) implementa o prontuário completo em abas:

| Aba | Descrição |
|---|---|
| Anamnese | Queixa principal, histórico, medicamentos, escala de dor (EVA 0–10) |
| Avaliações | Avaliações físicas — CRUD completo com edição/exclusão inline |
| Plano de Tratamento | Objetivos, técnicas, frequência, status |
| Evoluções | Notas de sessão — CRUD, vínculo com consulta |
| Histórico | Todas as consultas (status, procedimento, data) |
| Financeiro | Histórico de receitas/despesas por paciente |
| Alta Fisioterapêutica | Alta obrigatória pelo COFFITO: motivo, resultados, recomendações |

---

## Identidade Visual

- **Logo**: Figura estilizada em pose de reabilitação (braços estendidos + cruz médica) — `components/logo-mark.tsx`
- **Cor primária**: Teal profundo `hsl(180 100% 25%)` — identidade fisioterapêutica
- **Sidebar**: Teal escuro `hsl(183 50% 9%)` — coerência com a identidade
- **Tipografia**: Inter (corpo) + Outfit (títulos)
- **Ícones**: Lucide React — HeartHandshake (pacientes), Dumbbell (procedimentos), CalendarDays (agenda)

---

## Scripts

```bash
# Instalar dependências
pnpm install

# Iniciar os dois serviços
pnpm dev

# Compilar declarações TypeScript das libs compartilhadas (necessário antes do typecheck)
pnpm run build:libs

# Verificar tipos TypeScript (compila libs + verifica frontend + api-server)
pnpm run typecheck

# Sincronizar schema via lib/db
pnpm --filter @workspace/db exec drizzle-kit push --config drizzle.config.ts

# Seed de demonstração
pnpm run db:seed
```

### Notas sobre TypeScript

As libs compartilhadas (`lib/db`, `lib/api-zod`, `lib/api-client-react`) usam **TypeScript project references** (`composite: true`). Elas precisam ser compiladas antes de qualquer verificação de tipos:

```bash
pnpm run build:libs
# equivalente a:
tsc --build lib/db/tsconfig.json lib/api-zod/tsconfig.json lib/api-client-react/tsconfig.json
```

Os outputs ficam em `lib/*/dist/` (apenas `.d.ts`, via `emitDeclarationOnly`). Em desenvolvimento, o Vite e o `tsx` resolvem os imports diretamente das fontes `.ts` — o `build:libs` é necessário apenas para o `tsc --noEmit`.

---

## Credenciais de Demonstração

Criadas pelo seed (`pnpm run db:seed-demo`):

| E-mail | Senha | Perfis | Acesso |
|--------|-------|--------|--------|
| `admin@fisiogest.com.br` | `123456` | admin | Completo |
| `fisio@fisiogest.com.br` | `123456` | profissional | Pacientes, prontuário, agenda, relatórios |
| `rodrigo@fisiogest.com.br` | `123456` | profissional | Pacientes, prontuário, agenda, relatórios |
| `secretaria@fisiogest.com.br` | `123456` | secretaria | Agenda e consulta de pacientes |
| `marta@fisiogest.com.br` | `123456` | admin + profissional | Completo |

### Volume de dados (jan–abr/2026)

| Entidade | Quantidade |
|---|---|
| Usuários | 5 (3 roles distintos) |
| Procedimentos | 12 |
| Pacientes | 20 |
| Agendamentos | ~406 (jan–abr/2026) |
| Evoluções | ~272 (para cada sessão concluída) |
| Receitas | ~272 → R$ 37.730,00 |
| Despesas | 33 (fixas + variáveis, 3 meses) |
| Anamneses | 20 |
| Avaliações físicas | 20 |
| Planos de tratamento | 20 |
| Altas fisioterapêuticas | 3 |

### Colunas adicionadas ao schema (atualização 2026-03-22)

- `appointments.professional_id` — FK para `users.id`
- `appointments.clinic_id`
- `patients.clinic_id`
- `procedures.clinic_id`
- `financial_records.clinic_id`
- `financial_records.payment_date`
- `financial_records.payment_method`
- Tabelas RBAC criadas: `user_roles`, `permissions`, `roles_permissions`

---

## Funcionalidades Implementadas

| Funcionalidade | Status |
|---|---|
| Cadastro e busca de pacientes | ✅ Completo |
| Prontuário — Anamnese | ✅ Completo |
| Prontuário — Avaliações físicas (CRUD) | ✅ Completo |
| Prontuário — Plano de Tratamento | ✅ Completo |
| Prontuário — Evoluções de sessão (CRUD) | ✅ Completo |
| Prontuário — Alta Fisioterapêutica (COFFITO) | ✅ Completo |
| Prontuário — Jornada do Paciente (timeline) | ✅ Completo |
| Prontuário — Histórico de consultas | ✅ Completo |
| Prontuário — Extrato financeiro por paciente | ✅ Completo |
| Agenda semanal/diária/mensal + criação por clique | ✅ Completo |
| Agenda — detalhe, edição, cancelamento | ✅ Completo |
| Agendas independentes por clínica (geral e por profissional) | ✅ Completo |
| Slots bloqueados na agenda | ✅ Completo |
| Agendamento recorrente | ✅ Completo |
| Governança de horários (endTime calculado, conflitos) | ✅ Completo |
| Procedimentos com vagas múltiplas (maxCapacity) | ✅ Completo |
| Endpoint de vagas disponíveis | ✅ Completo |
| Procedimentos (CRUD + maxCapacity + gerador de catálogo PDF) | ✅ Completo |
| Pacotes de sessões (patient-packages) | ✅ Completo |
| Gestão de clínicas (multi-tenant) | ✅ Completo |
| Gestão de usuários e roles (RBAC) | ✅ Completo |
| Configurações da clínica | ✅ Completo |
| Financeiro global — Lançamentos | ✅ Completo |
| Financeiro — DRE Mensal | ✅ Completo |
| Financeiro — Custo por Procedimento (rateio overhead) | ✅ Completo |
| Financeiro — Orçado vs Realizado | ✅ Completo |
| Financeiro — Despesas Fixas Recorrentes (CRUD) | ✅ Completo |
| Relatórios (mensal, por procedimento, ocupação) | ✅ Completo |
| Dashboard com KPIs | ✅ Completo |
| Autenticação JWT | ✅ Completo |
| RBAC (admin, profissional, secretaria) | ✅ Completo |
| Multi-tenant por clínica | ✅ Completo |
| Padronização pt-BR (datas, moeda, idioma HTML) | ✅ Completo |
| Identidade visual fisioterapêutica | ✅ Completo |
| Audit log de ações | ✅ Completo |
| Notificações (WhatsApp/e-mail) | 🔲 Pendente |
| Agendamento self-service pelo paciente | 🔲 Pendente |
| Atestados médicos | 🔲 Pendente (schema existe) |
| Upload de anexos de exames | 🔲 Pendente (schema existe) |
| Fluxo de caixa projetado | 🔲 Pendente |
| Exportação PDF/CSV de relatórios | 🔲 Pendente |

---

## Defasagem: `src/` vs `artifacts/fisiogest/src/`

> ⚠️ **ATENÇÃO**: A pasta `src/` (destinada apenas à hospedagem externa — Hostinger/Railway) está **severamente desatualizada** em relação à versão Replit (`artifacts/fisiogest/src/`). Nunca use `src/` como referência do estado atual do sistema.

### Páginas presentes em `artifacts/fisiogest/src/pages/` mas **ausentes** em `src/pages/`

| Página | Arquivo | Funcionalidade |
|---|---|---|
| Landing Page pública | `landing.tsx` | Hero, features, pricing, FAQ, testimonials |
| Configurações da Clínica | `configuracoes.tsx` | Dados da clínica, horários, RBAC, integrações |
| Gestão de Usuários | `usuarios.tsx` | CRUD de profissionais, secretarias, roles |
| Gestão de Agendas | `agendas.tsx` | Criação e configuração de agendas por profissional |
| Agendamento | `agendar.tsx` | Fluxo completo de criação de agendamentos |
| Pacotes de Sessões | `pacotes.tsx` | Criação e gestão de pacotes/planos de tratamento |
| Gestão de Clínicas | `clinicas.tsx` | Administração multi-tenant (superadmin) |

### Páginas com implementação desatualizada em `src/pages/`

| Arquivo | Estado em `src/` | Estado em `artifacts/` |
|---|---|---|
| `patients/[id].tsx` | 200 linhas — só Anamnese. Abas Avaliações e Evoluções eram stubs (corrigido em 2026-04-07) | 5.631 linhas — 8 abas completas: Anamnese, Avaliações (CRUD), Plano de Tratamento, Evoluções (CRUD), Histórico, Financeiro, Alta Fisioterapêutica, Jornada |
| `agenda.tsx` | Visão semanal básica, sem bloqueios, sem recorrência | Completo com bloqueios, recorrência, múltiplos profissionais, código de cor |
| `procedimentos.tsx` | CRUD básico | CRUD + custos por clínica, override de preço, catálogo PDF, toggle ativo/inativo |
| `financial/index.tsx` | Apenas lançamentos básicos | 5 abas: Lançamentos, DRE, Custo por Procedimento, Orçado vs Realizado, Despesas Fixas |
| `relatorios.tsx` | Relatórios básicos | Relatórios com gráficos aprimorados, análise de ocupação, análise por dia da semana |

### O que foi historicamente marcado como "em construção" e já está implementado

Estas funcionalidades apareciam como stubs com a mensagem "em construção" em arquivos antigos. Todas estão **plenamente implementadas** em `artifacts/fisiogest/src/`:

| Funcionalidade | Onde estava marcado | Status atual |
|---|---|---|
| Avaliações físicas | `src/pages/patients/[id].tsx` linha 84 | ✅ CRUD completo em `artifacts/.../patients/[id].tsx` |
| Evoluções de sessão | `src/pages/patients/[id].tsx` linha 88 | ✅ CRUD completo com vínculo a consulta e EVA em `artifacts/.../patients/[id].tsx` |

> As mensagens "em construção" em `src/` foram atualizadas em 2026-04-07 para refletir que os módulos estão implementados mas este arquivo é um stub desatualizado.

---

## Correções e Melhorias (2026-03-28 — Análise Completa de Rotas)

### Backend

| # | Arquivo | Bug corrigido |
|---|---|---|
| 1 | `routes/patients.ts` | CPF não era normalizado (strip de pontos/traços) antes de salvar no banco — permitia duplicatas com formatos diferentes. Agora normalizado em POST e PUT. |
| 2 | `routes/patients.ts` | Validação de CPF adicionada (deve ter exatamente 11 dígitos após normalização) retornando 400 com mensagem descritiva. |
| 3 | `routes/patients.ts` | Busca por CPF agora também pesquisa o valor normalizado (sem máscara), permitindo buscar `123.456.789-01` ou `12345678901` com o mesmo resultado. |
| 4 | `routes/financial.ts` | Dashboard usava `createdAt` para filtrar receitas — data de criação do registro, não de pagamento. Agora usa `paymentDate` (quando disponível) para cálculo correto de receitas mensais. |
| 5 | `routes/auth.ts` | Registro de usuário+clínica não era atômico — se o insert de `userRolesTable` falhasse, usuário e clínica ficavam órfãos no banco. Agora envolvido em transação Drizzle. |
| 6 | `routes/auth.ts` | Validação de CPF adicionada no registro (11 dígitos), evitando cadastros com CPF malformado. |

### Frontend

| # | Arquivo | Bug corrigido |
|---|---|---|
| 7 | `App.tsx` | Interceptor `window.fetch` não tratava respostas 401 — token expirado deixava o app em estado quebrado. Agora detecta 401 em qualquer rota não-auth, limpa localStorage e redireciona para `/login`. |
| 8 | `pages/patients/index.tsx` | Busca disparava request a cada tecla digitada sem debounce. Adicionado debounce de 300 ms com `useEffect` + `clearTimeout`. |
| 9 | `pages/patients/index.tsx` | CPF exibido nos cards e lista sem formatação (dígitos crus). Agora usa `displayCpf()` de `lib/masks.ts` para exibir sempre no formato `000.000.000-00`. |

---

## Correções de TypeScript (2026-03-28)

Corrigidos os seguintes erros ao migrar para o ambiente Replit:

1. **TS6305** — Declarações `.d.ts` das libs compartilhadas ausentes: resolvido compilando as libs com `pnpm run build:libs`. Scripts `"build"` adicionados a `lib/db`, `lib/api-zod` e `lib/api-client-react`.
2. **TS2345 em `procedimentos.tsx`** — `resetForm()` e `openEdit()` não passavam `monthlyPrice` e `billingDay` no `setForm()`.
3. **TS2345 em `clinics.ts`** — `req.params.id` sem cast `as string` para `parseInt()` (tipagem Express 5).
4. **TS2345 em `schedules.ts`** — mesmo problema de `req.params.id as string`.
5. **TS2345 em `patient-packages.ts`** — permissions inválidas (`"patients.write"`, `"appointments.write"`) substituídas pelas corretas (`"patients.create"`, `"patients.update"`, `"patients.delete"`, `"appointments.update"`).
6. **TS7030 em `users.ts`** — nem todos os caminhos de código retornavam valor nos handlers; removidos `return` antes de `res.json()` para tornar os handlers consistentemente `void`.
7. **`scripts/post-merge.sh`** — adicionado `pnpm run build:libs` após o `pnpm install` para garantir que as declarações TypeScript estejam disponíveis após merges.

---

## Correções de TypeScript e Rotas (2026-03-29)

Análise completa com `tsc --noEmit` após compilar as libs. **Zero erros** em ambos os pacotes após as correções abaixo.

### Processo correto de verificação de tipos

As libs precisam ser compiladas antes de qualquer `tsc --noEmit`:
```bash
pnpm --filter @workspace/db build
pnpm --filter @workspace/api-zod build
pnpm --filter @workspace/api-client-react build
# Depois:
cd artifacts/api-server && npx tsc --noEmit
cd artifacts/fisiogest && npx tsc --noEmit
```

### Erros corrigidos

| # | Arquivo | Erro | Correção |
|---|---|---|---|
| 1 | `api-server/src/routes/public.ts:551` | **TS7030** — `GET /clinic-info`: nem todos os caminhos retornavam valor (`return res.json(...)` no branch `!clinic` tornava a função inconsistente) | Separado em `res.json(...); return;` para manter o handler como `void` consistente |
| 2 | `api-spec/openapi.yaml` | **Spec desatualizada** — `Evolution` e `CreateEvolutionRequest` não incluíam `painScale`, embora o DB schema e o backend já suportassem o campo | Adicionado `painScale: integer (0–10)` em ambos os schemas do OpenAPI |
| 3 | `lib/api-client-react/src/generated/api.schemas.ts` | **TS2339** — `Property 'painScale' does not exist on type 'Evolution'` em 14 locais de `patients/[id].tsx` | Adicionado `painScale?: number` nas interfaces `Evolution` e `CreateEvolutionRequest` geradas; rebuild do pacote |
| 4 | `fisiogest/src/pages/patients/[id].tsx:2691` | **TS2322** — `buildPayload()` passava `painScale: number \| null` mas `CreateEvolutionRequest.painScale` é `number \| undefined` | `buildPayload()` agora usa `painScale: form.painScale ?? undefined` para converter `null` em `undefined` |

---

## Correções de Segurança e Bugs (2026-03-29 — 2ª rodada)

Análise completa (backend + frontend) detectou bugs de segurança multi-tenant e problemas de UX. **Zero erros TypeScript** mantidos após todas as correções.

### Backend — Segurança Multi-tenant

| # | Arquivo | Problema | Correção |
|---|---|---|---|
| 1 | `routes/patients.ts` | Validação de CPF usava apenas verificação de comprimento (11 dígitos), ignorando o algoritmo de módulo 11 | Agora usa `validateCpf()` completa (sequências repetidas + dois dígitos verificadores) |
| 2 | `routes/patients.ts` | CPF duplicado retornava HTTP 400 Bad Request | Corrigido para HTTP **409 Conflict** (padrão REST para recurso duplicado) |
| 3 | `routes/appointments.ts` DELETE /:id | `DELETE` não filtrava por `clinicId` — qualquer admin autenticado podia deletar agendamentos de outra clínica | Adicionado filtro `AND clinicId = req.clinicId` no WHERE; retorna 404 se não encontrado |
| 4 | `routes/appointments.ts` PUT /:id | `UPDATE` não filtrava por `clinicId` no WHERE — permitia editar agendamentos de outras clínicas | Adicionado `updateWhere` com clinicId isolado |
| 5 | `routes/medical-records.ts` | Nenhuma rota verificava se o `patientId` da URL pertencia à clínica do usuário logado — prontuário cross-clinic acessível | Adicionado middleware no router que valida posse do paciente via `clinicId` antes de qualquer handler |
| 6 | `routes/financial.ts` | 5 endpoints de paciente (`/history`, `/summary`, `/payment`, `/credits`, `/subscriptions`) não verificavam se o paciente pertencia à clínica | Adicionado helper `assertPatientInClinic()` chamado no início de cada endpoint; retorna 403 se violado |

### Frontend — Correções de UX

| # | Arquivo | Problema | Correção |
|---|---|---|---|
| 7 | `pages/financial/index.tsx` | `CreateRecordForm` não resetava os campos após salvar com sucesso — dados do lançamento anterior persistiam ao reabrir o dialog | Reset completo de todos os campos (`type`, `expenseMode`, `amount`, `description`, `category`, `procedureId`) no `onSuccess` |
| 8 | `pages/relatorios.tsx` | Três `fetch()` para relatórios chamavam `.json()` sem verificar `r.ok` — erros HTTP silenciosos podiam retornar HTML de erro como dados | Adicionado `if (!r.ok) throw new Error(...)` antes de cada `.json()`, permitindo que TanStack Query trate o estado de erro |

---

## Correções de Compatibilidade Express 5 + Melhorias (2026-04-02)

### Backend

| # | Arquivo | Problema | Correção |
|---|---|---|---|
| 1 | `routes/storage.ts` | Rotas wildcard `"/public-objects/*filePath"` e `"/objects/*path"` usavam sintaxe Express 4 inválida em Express 5 / path-to-regexp v8 — causaria erro de runtime ao registrar as rotas | Corrigido para sintaxe Express 5: `"/public-objects/{*filePath}"` e `"/objects/{*objPath}"` com acesso via `req.params.filePath/objPath` |
| 2 | `lib/db/src/index.ts` | `sslmode=require` na `DATABASE_URL` disparava aviso de deprecação do pg v8 em toda inicialização | Substituição automática de `sslmode=require` → `sslmode=verify-full` na string de conexão (mesma segurança, sem warning) |

### Frontend

| # | Arquivo | Problema | Correção |
|---|---|---|---|
| 3 | `lib/auth-context.tsx` | `switchClinic()` usava `window.location.href = "/dashboard"` (hard reload + caminho absoluto) ao trocar de clínica | Substituído por `setLocation("/dashboard")` (navegação suave via Wouter, respeitando o base path) |
| 4 | `App.tsx` | Interceptor 401 redirecionava via `window.location.href = "/login"` com caminho absoluto fixo | Agora usa `import.meta.env.BASE_URL` para compor o caminho: `${base}/login`, garantindo funcionamento com qualquer base path de deploy |
