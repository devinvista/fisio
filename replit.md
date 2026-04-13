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

## Design System — Padrões de UI

Convenções visuais estabelecidas e aplicadas nas páginas principais.

### KpiCard (padrão de cartão de KPI)
Todas as páginas usam o mesmo sistema de cards com barra lateral colorida:
- `relative bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden`
- Barra esquerda: `absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl` com `backgroundColor: accentColor`
- Ícone: `p-2 rounded-xl` com fundo `${accentColor}18` (18% opacidade) e cor do ícone igual ao accent
- Rótulo: `text-[10px] font-bold text-slate-400 uppercase tracking-widest`
- Valor: `text-2xl font-extrabold text-slate-900 tabular-nums`

### Semântica de cores (accentColor)
| Cor | Hex | Uso |
|---|---|---|
| Verde esmeralda | `#10b981` | Receita, positivo, concluído |
| Vermelho | `#ef4444` | Despesas, negativo, cancelado |
| Índigo | `#6366f1` | Lucro, métrica principal |
| Âmbar | `#f59e0b` | Avisos, pendências, faltas |
| Céu | `#0ea5e9` | Agendamentos, info |
| Violeta | `#8b5cf6` | Métricas secundárias |

### Seletor de período (pattern)
```tsx
<div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm border border-slate-200">
  <CalendarDays className="w-4 h-4 text-slate-400" />
  <Select>...</Select>
  <div className="h-4 w-px bg-slate-200" />
  <Select>...</Select>
</div>
```

### Tabelas
- Header: `bg-slate-50/80 border-b border-slate-100`
- Rótulo header: `text-[10px] font-bold text-slate-400 uppercase tracking-widest`
- Linhas: `border-b border-slate-50 hover:bg-slate-50/60`
- Moeda: `tabular-nums font-semibold text-emerald-600`
- Footer: `bg-slate-50 border-t-2 border-slate-200`

### Badges de status de agendamento
```tsx
const STATUS_CONFIG = {
  agendado:  { dot: "bg-blue-400",   text: "text-blue-700",   bg: "bg-blue-50"   },
  confirmado:{ dot: "bg-green-500",  text: "text-green-700",  bg: "bg-green-50"  },
  concluido: { dot: "bg-slate-400",  text: "text-slate-600",  bg: "bg-slate-100" },
  cancelado: { dot: "bg-red-400",    text: "text-red-700",    bg: "bg-red-50"    },
  faltou:    { dot: "bg-orange-400", text: "text-orange-700", bg: "bg-orange-50" },
}
```
Formato: `inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full`

### Badges de status financeiro
```tsx
const STATUS_FINANCEIRO = {
  pago:      { dot: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50" },
  pendente:  { dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50"   },
  estornado: { dot: "bg-red-400",     text: "text-red-600",     bg: "bg-red-50"     },
  cancelado: { dot: "bg-slate-300",   text: "text-slate-500",   bg: "bg-slate-50"   },
  // Inadimplente (pendente + dueDate < hoje):
  vencido:   { dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50"     },
  // Badge: "Vencido há Xd" — linha da tabela com bg-red-50/30
}
```

### Estados de carregamento
- **Nunca usar spinners centralizados** (`Loader2`, `animate-spin`)
- Sempre usar skeleton: `animate-pulse` com divs de `bg-slate-100` nas dimensões esperadas
- Skeletons de tabela: simular estrutura de linhas idêntica à tabela real
- Skeletons de KpiCard: dois divs (`h-7 w-28` para valor, `h-3 w-16` para sub)

### Estados vazios
- Container centralizado com ícone em `bg-slate-100 rounded-2xl w-12 h-12`
- Título em `text-sm font-semibold text-slate-500`
- Descrição em `text-xs text-slate-400 mt-1`
- CTA opcional com `Button size="sm" variant="outline" rounded-xl`

### Páginas já redesenhadas
- `financial/index.tsx` — KpiCards, abas pill, tabela de transações com aging, DRE
- `relatorios.tsx` — KpiCards duplos (anual/mensal), charts limpos, tabela de procedimentos
- `dashboard.tsx` — KpiCards, greeting, status badges Tailwind, skeleton loading, booking portal compacto
- `patients/index.tsx` — stats strip com KpiCards, skeleton de lista

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
| Frontend | `@workspace/fisiogest` | **3000** | `/` |
| API Server | `@workspace/api-server` | **8080** | `/api` |

> **Nunca execute o layout raiz (`src/` + `server/`) no Replit.** Esses arquivos existem apenas para hospedagem externa (ex.: Hostinger/Railway/Render).

### Workflows (artifact-based)

Os serviços são iniciados por workflows individuais gerenciados pelo Replit:
- `API Server` → `PORT=8080 pnpm --filter @workspace/api-server run dev`
- `Frontend` → `PORT=3000 pnpm --filter @workspace/fisiogest run dev`

### Fluxo de requisições em desenvolvimento

```
Browser → https://<repl>.replit.dev/
  ├── /api/*  → Proxy Replit → localhost:8080  (api-server)
  └── /*      → Proxy Replit → localhost:3000  (fisiogest Vite dev server)
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
│   │   │   │   ├── landing.tsx         # Landing page pública
│   │   │   │   ├── dashboard.tsx
│   │   │   │   ├── agenda.tsx
│   │   │   │   ├── procedimentos.tsx
│   │   │   │   ├── relatorios.tsx
│   │   │   │   ├── patients/
│   │   │   │   │   ├── index.tsx       # Lista de pacientes + busca
│   │   │   │   │   └── [id].tsx        # Prontuário completo (abas)
│   │   │   │   └── financial/
│   │   │   │       └── index.tsx       # Lançamentos, custos, DRE, despesas fixas
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
│   │       ├── middleware/
│   │       │   ├── auth.ts             # JWT authMiddleware
│   │       │   └── rbac.ts             # requirePermission()
│   │       ├── lib/
│   │       │   ├── dateUtils.ts        # todayBRT(), nowBRT()
│   │       │   ├── auditLog.ts         # logAudit()
│   │       │   └── validate.ts         # validateBody()
│   │       └── routes/
│   │           ├── index.ts            # Agrega todos os routers
│   │           ├── health.ts           # GET /api/healthz
│   │           ├── public.ts           # /api/public (landing data)
│   │           ├── auth.ts             # /api/auth
│   │           ├── clinics.ts          # /api/clinics
│   │           ├── users.ts            # /api/users
│   │           ├── patients.ts         # /api/patients
│   │           ├── medical-records.ts  # /api/patients/:patientId (mergeParams)
│   │           ├── patient-journey.ts  # /api/patients/:patientId (mergeParams)
│   │           ├── patient-packages.ts # /api/patients/:patientId/packages
│   │           ├── procedures.ts       # /api/procedures + overhead-analysis
│   │           ├── packages.ts         # /api/packages
│   │           ├── treatment-plan-procedures.ts # /api/treatment-plans/:planId/procedures
│   │           ├── appointments.ts     # /api/appointments
│   │           ├── schedules.ts        # /api/schedules
│   │           ├── blocked-slots.ts    # /api/blocked-slots
│   │           ├── financial.ts        # /api/financial
│   │           ├── subscriptions.ts    # /api/subscriptions
│   │           ├── reports.ts          # /api/reports
│   │           ├── dashboard.ts        # /api/dashboard
│   │           ├── storage.ts          # /api/storage
│   │           ├── audit-log.ts        # /api/audit-log
│   │           └── recurring-expenses.ts # /api/recurring-expenses
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
│   ├── api-zod/                        # @workspace/api-zod — schemas Zod compartilhados
│   ├── api-client-react/               # @workspace/api-client-react — hooks React Query (Orval)
│   └── api-spec/                       # Especificação OpenAPI
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
| `clinics` | id, name, cnpj, address, phone, email |
| `patients` | id, clinicId, name, cpf (único), birthDate, phone, email, address, profession, emergencyContact, notes |
| `procedures` | id, name, category, modalidade, durationMinutes, price, cost, **maxCapacity** (default 1), isActive |
| `procedure_costs` | id, procedureId, clinicId, priceOverride, fixedCost, variableCost, notes |
| `appointments` | id, patientId, procedureId, clinicId, scheduleId, date, startTime, **endTime** (calculado), status, notes |
| `schedules` | id, clinicId, type (clinic/professional), name, workingDays, startTime, endTime, isActive |
| `blocked_slots` | id, clinicId, scheduleId, date, startTime, endTime, reason |
| `anamnesis` | id, patientId (único), mainComplaint, diseaseHistory, medications, painScale… |
| `evaluations` | id, patientId, inspection, posture, rangeOfMotion, muscleStrength, orthopedicTests, functionalDiagnosis |
| `treatment_plans` | id, patientId (múltiplos por paciente), **clinicId** (FK → clinics), objectives, techniques, frequency, estimatedSessions, status |
| `evolutions` | id, patientId, appointmentId (FK opcional), description, patientResponse, clinicalNotes, complications, **painScale** (0–10) |
| `discharge_summaries` | id, patientId (único), dischargeDate, dischargeReason, achievedResults, recommendations |
| `patient_subscriptions` | id, patientId, procedureId, startDate, billingDay, monthlyAmount, status, clinicId, cancelledAt, nextBillingDate |
| `session_credits` | id, patientId, procedureId, quantity, usedQuantity, clinicId, notes |
| `financial_records` | id, type (receita/despesa), amount, description, category, **status** (pendente/pago/cancelado/estornado), **dueDate** (vencimento), **paymentDate** (data de pagamento), **paymentMethod** (forma de pagamento), transactionType, appointmentId?, patientId?, procedureId?, subscriptionId?, clinicId |
| `recurring_expenses` | id, clinicId, name, category, amount, frequency (mensal/anual/semanal), isActive, notes |
| `audit_log` | id, userId, action, entityType, entityId, patientId, summary, createdAt |

### Comandos de schema

```bash
# Sincronizar schema (pede confirmação em mudanças destrutivas)
pnpm --filter @workspace/db exec drizzle-kit push --config drizzle.config.ts

# Seed financeiro incremental (criar agendamentos + registros financeiros sem duplicar)
tsx scripts/seed-financial.ts

# Seed completo (somente se a clínica e usuários NÃO existirem — cria novo clinic)
pnpm run db:seed-demo
```

### Estado atual do banco (abril/2026)

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
| POST | `/api/appointments/recurring` | Criar série recorrente |
| GET | `/api/appointments/:id` | Detalhe |
| PUT | `/api/appointments/:id` | Atualizar — recalcula endTime |
| DELETE | `/api/appointments/:id` | Excluir |
| POST | `/api/appointments/:id/complete` | Concluir + gerar registro financeiro |
| GET | `/api/appointments/available-slots` | Horários disponíveis (date, procedureId, clinicStart, clinicEnd) |

### Procedimentos
| Método | Caminho | Descrição |
|---|---|---|
| GET | `/api/procedures` | Listar — LEFT JOIN `procedure_costs`; retorna `effectivePrice`, `effectiveTotalCost`, `isGlobal` |
| POST | `/api/procedures` | Criar |
| PUT | `/api/procedures/:id` | Atualizar dados base |
| PATCH | `/api/procedures/:id/toggle-active` | Ativar / desativar |
| GET | `/api/procedures/:id/costs` | Obter configuração de custos da clínica |
| PUT | `/api/procedures/:id/costs` | Upsert de custos da clínica |
| DELETE | `/api/procedures/:id/costs` | Remover override de custos |
| DELETE | `/api/procedures/:id` | Excluir (cascade em `procedure_costs`) |
| GET | `/api/procedures/overhead-analysis` | Análise de overhead (month, year, procedureId) |

### Financeiro
| Método | Caminho | Descrição |
|---|---|---|
| GET | `/api/financial/dashboard` | KPIs mensais — receita, despesas, lucro, MRR, cobranças pendentes |
| GET | `/api/financial/records` | Listar registros (filtros: type, month, year) |
| POST | `/api/financial/records` | Criar registro manual — aceita status, dueDate, paymentMethod |
| **PATCH** | **`/api/financial/records/:id`** | **Editar lançamento completo (todos os campos)** |
| PATCH | `/api/financial/records/:id/status` | Atualizar apenas status + paymentDate + paymentMethod |
| PATCH | `/api/financial/records/:id/estorno` | Soft-reversal: status=estornado |
| DELETE | `/api/financial/records/:id` | Deleta despesas; estorna receitas (soft) |
| GET | `/api/financial/patients/:id/history` | Histórico financeiro completo do paciente |
| GET | `/api/financial/patients/:id/summary` | Saldo: totalAReceber, totalPago, saldo, totalSessionCredits |
| POST | `/api/financial/patients/:id/payment` | Registrar pagamento (transactionType=pagamento) |
| GET | `/api/financial/patients/:id/credits` | Créditos de sessão do paciente |
| GET | `/api/financial/patients/:id/subscriptions` | Assinaturas ativas do paciente |
| GET | `/api/financial/cost-per-procedure` | Análise de custo por procedimento (month, year) |
| GET | `/api/financial/dre` | DRE mensal: receita bruta, despesas por categoria, lucro, variância |

### Despesas Fixas / Recorrentes
| Método | Caminho | Descrição |
|---|---|---|
| GET | `/api/recurring-expenses` | Listar despesas fixas da clínica |
| POST | `/api/recurring-expenses` | Criar |
| PATCH | `/api/recurring-expenses/:id` | Editar |
| DELETE | `/api/recurring-expenses/:id` | Excluir |

### Assinaturas
| Método | Caminho | Descrição |
|---|---|---|
| GET | `/api/subscriptions` | Listar assinaturas |
| POST | `/api/subscriptions` | Criar assinatura |
| PATCH | `/api/subscriptions/:id` | Atualizar |
| DELETE | `/api/subscriptions/:id` | Cancelar |
| GET | `/api/subscriptions/billing-status` | Status do billing automático + próximas cobranças |
| POST | `/api/subscriptions/run-billing` | Executar cobrança manual (idempotente) |

### Horários e Agenda
| Método | Caminho | Descrição |
|---|---|---|
| GET | `/api/schedules` | Listar horários da clínica |
| POST | `/api/schedules` | Criar horário |
| PUT | `/api/schedules/:id` | Atualizar |
| DELETE | `/api/schedules/:id` | Excluir |
| GET | `/api/blocked-slots` | Listar bloqueios |
| POST | `/api/blocked-slots` | Criar bloqueio |
| DELETE | `/api/blocked-slots/:id` | Remover bloqueio |

### Relatórios e Dashboard
| Método | Caminho | Descrição |
|---|---|---|
| GET | `/api/dashboard` | KPIs do dashboard principal |
| GET | `/api/reports` | Relatórios por período |
| GET | `/api/audit-log` | Log de auditoria |

---

## Modelo Financeiro

**Lógica de datas dos registros:**
- `dueDate` — data de vencimento (quando o pagamento é esperado)
- `paymentDate` — data em que o pagamento foi efetivamente realizado
- Registros pendentes: `paymentDate = null`, `dueDate` preenchido
- Registros pagos: ambos preenchidos

**Filtro de período** (endpoint `/records` e `/dashboard`):
1. `paymentDate` no intervalo → registros pagos no mês
2. `paymentDate = null` mas `dueDate` no intervalo → pendências do mês
3. Ambos nulos → fallback para `createdAt` (registros legados)

**Aging (inadimplência):**
- Frontend calcula `daysOverdue = today - dueDate` para registros `status=pendente`
- Badge "Vencido há Xd" em vermelho; linha da tabela com fundo `bg-red-50/30`

**Formas de pagamento disponíveis:** Dinheiro, Pix, Cartão de Crédito, Cartão de Débito, Transferência, Boleto, Cheque, Outros

**Status dos registros:**
- `pendente` — a pagar/receber (paymentDate não preenchido)
- `pago` — liquidado
- `cancelado` — cancelado sem estorno
- `estornado` — soft-reversal de receita (nunca hard-delete)

**Transaction types** (gerados automaticamente pelo sistema):
- `creditoAReceber` — sessão agendada gera crédito a receber
- `cobrancaSessao` — cobrança avulsa de sessão
- `cobrancaMensal` — gerado pelo billing automático de assinatura
- `pagamento` — registro de recebimento do paciente
- `usoCredito`, `creditoSessao`, `ajuste`, `estorno`

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

## Módulo Financeiro (Aba Lançamentos)

### Funcionalidades implementadas

| Funcionalidade | Status |
|---|---|
| KPIs mensais (receita, despesa, lucro, ticket médio) | ✅ |
| MRR + assinaturas ativas | ✅ |
| Gráfico de receita por categoria (donut) | ✅ |
| Tabela de lançamentos com filtro por tipo | ✅ |
| Criação de lançamento com status, vencimento e forma de pagamento | ✅ |
| Edição completa de lançamento (modal) | ✅ |
| Exclusão / estorno de lançamento | ✅ |
| Destaque de inadimplência com aging (dias em atraso) | ✅ |
| Coluna de forma de pagamento na tabela | ✅ |
| Billing automático de assinaturas | ✅ |
| Aba Custo por Procedimento | ✅ |
| Aba Orçado vs Realizado | ✅ |
| Aba DRE Mensal | ✅ |
| Aba Despesas Fixas (CRUD) | ✅ |

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

**Status TypeScript (abril/2026):** Frontend e API Server sem erros após `build:libs`.

---

## Credenciais de Demonstração

Criadas pelo seed (`pnpm run db:seed-demo`):

| E-mail | Senha | Perfis | Acesso |
|--------|-------|--------|--------|
| `admin@fisiogest.com.br` | `123456` | admin | Completo |
| `mwschuch@gmail.com` | `123456` | admin + profissional | Clínica id=3 |
