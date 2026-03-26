# FisioGest Pro

## Visão Geral

FisioGest Pro é uma plataforma SaaS de gestão clínica completa para fisioterapeutas, estetas e instrutores de pilates. Abrange prontuário eletrônico, agenda, financeiro, relatórios e conformidade com normas do COFFITO.

O projeto é um **monorepo pnpm** hospedado no Replit. Dividido em dois artefatos (frontend + API) servidos pelo proxy reverso compartilhado do Replit na porta 80.

**Idioma padrão**: Português do Brasil (pt-BR)
**Moeda**: Real Brasileiro (BRL — R$)
**Medidas**: Sistema Internacional (SI) — kg, cm, °C
**Formato de data**: dd/MM/yyyy (ex.: 18/03/2026)
**Formato de hora**: HH:mm — 24 horas (ex.: 14:30)
**Separador decimal**: vírgula (ex.: R$ 1.250,00)
**Separador de milhar**: ponto (ex.: 1.250)
**Fuso horário padrão**: America/Sao_Paulo (UTC-3 / UTC-2 no horário de verão)

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
│   └── seed-demo.ts                    # Seed completo: 5 pacientes, jan–mar 2026
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
| `treatment_plans` | id, patientId (único), objectives, techniques, frequency, estimatedSessions, status |
| `evolutions` | id, patientId, appointmentId (FK opcional), description, patientResponse, clinicalNotes, complications |
| `discharge_summaries` | id, patientId (único), dischargeDate, dischargeReason, achievedResults, recommendations |
| `financial_records` | id, type (receita/despesa), amount, description, category, appointmentId?, patientId?, procedureId? (FK → procedures) |

### Comandos de schema

```bash
# Sincronizar schema (pede confirmação em mudanças destrutivas)
pnpm --filter @workspace/db exec drizzle-kit push --config drizzle.config.ts

# Seed demo completo (jan–mar 2026)
pnpm run db:seed
```

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
| GET/POST | `/treatment-plan` | Upsert plano de tratamento |
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
| GET | `/api/procedures` | Listar (filtro: category) |
| POST | `/api/procedures` | Criar |
| PUT | `/api/procedures/:id` | Atualizar (inclui maxCapacity) |
| DELETE | `/api/procedures/:id` | Excluir |

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

# Sincronizar schema via lib/db
pnpm --filter @workspace/db exec drizzle-kit push --config drizzle.config.ts

# Verificar tipos TypeScript
pnpm run typecheck

# Seed de demonstração
pnpm run db:seed
```

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
| Agenda semanal + criação por clique | ✅ Completo |
| Agenda — detalhe, edição, cancelamento | ✅ Completo |
| Agendas independentes por clínica (geral e por profissional) | ✅ Completo |
| Governança de horários (endTime calculado, conflitos) | ✅ Completo |
| Procedimentos com vagas múltiplas (maxCapacity) | ✅ Completo |
| Endpoint de vagas disponíveis | ✅ Completo |
| Procedimentos (CRUD + maxCapacity) | ✅ Completo |
| Financeiro global (receitas, despesas, dashboard) | ✅ Completo |
| Relatórios (mensal, por procedimento, ocupação) | ✅ Completo |
| Dashboard com KPIs | ✅ Completo |
| Autenticação JWT | ✅ Completo |
| Padronização pt-BR (datas, moeda, idioma HTML) | ✅ Completo |
| Identidade visual fisioterapêutica | ✅ Completo |
| Notificações (WhatsApp/e-mail) | 🔲 Pendente |
| Agendamento self-service pelo paciente | 🔲 Pendente |
