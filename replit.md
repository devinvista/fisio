# FisioGest Pro

## Overview

FisioGest Pro is a complete clinical management SaaS platform for physiotherapy, aesthetics, and pilates clinics. It handles patient records, clinical documentation, scheduling, financial tracking, and regulatory compliance (COFFITO).

The project is a **pnpm workspace monorepo** hosted on Replit. It is split into two artifacts (frontend + API) that are served through Replit's shared reverse proxy on port 80.

---

## Stack

- **Node.js**: 24
- **Package manager**: pnpm 10.26 (workspace)
- **TypeScript**: 5.9
- **Frontend** (`artifacts/fisiogest`): React 19 + Vite 7 + TailwindCSS v4 + shadcn/ui (new-york)
- **Backend** (`artifacts/api-server`): Express 5
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Validation**: Zod v3, drizzle-zod (`lib/api-zod`)
- **API client**: Orval-generated React Query hooks (`lib/api-client-react`)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Charts**: Recharts
- **Icons**: Lucide React + react-icons

---

## Replit Architecture — IMPORTANT

Replit uses a **shared reverse proxy on port 80** to route traffic between services. Each artifact declares its port and path prefix in `.replit-artifact/artifact.toml`.

| Service | Package filter | Local port | Proxy path |
|---|---|---|---|
| Frontend | `@workspace/fisiogest` | **20408** | `/` |
| API Server | `@workspace/api-server` | **8080** | `/api` |

> **Never run the root-level `src/` + `server/` flat layout in Replit.** Those files exist for external hosting (e.g., Hostinger/Railway/Render) only. In Replit, always run the artifacts.

### Workflow command (`.replit`)

```
PORT=8080 pnpm --filter @workspace/api-server run dev & PORT=20408 API_PORT=8080 pnpm --filter @workspace/fisiogest run dev
```

- `waitForPort = 20408` — Replit waits for the frontend to be ready
- `outputType = "webview"` — routes preview to the frontend

### How requests flow in development

```
Browser → https://<repl>.replit.dev/
  ├── /api/*  → Replit proxy → localhost:8080  (api-server)
  └── /*      → Replit proxy → localhost:20408 (fisiogest Vite dev server)
                  └── /api/* (proxied by Vite) → localhost:8080
```

---

## Project Structure

```text
/
├── artifacts/
│   ├── fisiogest/                      # React frontend (@workspace/fisiogest)
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── index.css
│   │   │   ├── pages/
│   │   │   │   ├── index.tsx           # Redirect to /dashboard
│   │   │   │   ├── login.tsx
│   │   │   │   ├── register.tsx
│   │   │   │   ├── dashboard.tsx
│   │   │   │   ├── agenda.tsx
│   │   │   │   ├── not-found.tsx
│   │   │   │   ├── patients/
│   │   │   │   │   ├── index.tsx       # Patient list + search
│   │   │   │   │   └── [id].tsx        # Full patient chart (prontuário)
│   │   │   │   ├── financial/
│   │   │   │   │   └── index.tsx       # Financial dashboard + records
│   │   │   │   ├── procedimentos.tsx
│   │   │   │   └── relatorios.tsx
│   │   │   ├── components/
│   │   │   │   ├── layout/app-layout.tsx
│   │   │   │   └── ui/                 # shadcn/ui components
│   │   │   └── lib/
│   │   │       └── auth-context.tsx
│   │   ├── vite.config.ts              # PORT=20408, proxy /api → :8080
│   │   └── .replit-artifact/artifact.toml
│   │
│   ├── api-server/                     # Express API (@workspace/api-server)
│   │   ├── src/
│   │   │   ├── index.ts                # Requires PORT env var
│   │   │   ├── app.ts
│   │   │   ├── middleware/auth.ts      # JWT authMiddleware
│   │   │   └── routes/
│   │   │       ├── index.ts
│   │   │       ├── health.ts           # GET /api/healthz
│   │   │       ├── auth.ts             # POST /api/auth/register|login|me
│   │   │       ├── patients.ts         # CRUD /api/patients — totalSpent via LEFT JOIN
│   │   │       ├── procedures.ts       # CRUD /api/procedures
│   │   │       ├── appointments.ts     # CRUD /api/appointments
│   │   │       ├── medical-records.ts  # Nested under /api/patients/:id/*
│   │   │       ├── financial.ts        # /api/financial/dashboard|records
│   │   │       ├── reports.ts          # /api/reports/*
│   │   │       └── dashboard.ts        # /api/dashboard
│   │   ├── build.ts
│   │   └── .replit-artifact/artifact.toml
│   │
│   └── mockup-sandbox/                 # UI prototyping sandbox
│
├── lib/
│   ├── db/                             # @workspace/db — Drizzle ORM + schema
│   │   ├── src/
│   │   │   ├── index.ts                # pg Pool + drizzle client export
│   │   │   └── schema/
│   │   │       ├── index.ts
│   │   │       ├── patients.ts
│   │   │       ├── appointments.ts
│   │   │       ├── procedures.ts
│   │   │       ├── medical-records.ts  # anamnesis, evaluations, treatment_plans,
│   │   │       │                       # evolutions, discharge_summaries
│   │   │       ├── financial.ts
│   │   │       └── users.ts
│   │   └── drizzle.config.ts
│   ├── api-zod/                        # @workspace/api-zod — Zod validation schemas
│   ├── api-client-react/               # @workspace/api-client-react — React Query hooks
│   │   └── src/
│   │       ├── index.ts
│   │       ├── custom-fetch.ts
│   │       └── generated/
│   │           ├── api.ts              # All hooks (useGetPatient, useSaveDischarge, …)
│   │           └── api.schemas.ts
│   └── api-spec/                       # OpenAPI spec source
│
├── src/                                # [EXTERNAL HOSTING ONLY] Flat frontend layout
├── server/                             # [EXTERNAL HOSTING ONLY] Flat server layout
├── db/                                 # [EXTERNAL HOSTING ONLY] Flat DB layout
│
├── scripts/
│   ├── post-merge.sh                   # Runs after task agent merges
│   └── seed.ts
│
├── pnpm-workspace.yaml
├── package.json                        # Root scripts + shared dev tooling
├── drizzle.config.ts                   # Points to db/schema (root flat layout)
└── .replit                             # Workflow + artifact config
```

---

## Database Schema

All tables live in the PostgreSQL database provisioned by Replit. The canonical schema is in `lib/db/src/schema/` (used by the artifacts). The flat layout in `db/schema/` is kept in sync.

| Table | Key fields |
|---|---|
| `users` | id, email, passwordHash, name, role |
| `patients` | id, name, cpf (unique), birthDate, phone, email, address, profession, emergencyContact, notes |
| `procedures` | id, name, category, duration, price, cost |
| `appointments` | id, patientId, procedureId, date, startTime, endTime, status, notes |
| `anamnesis` | id, patientId (unique), mainComplaint, diseaseHistory, medications, painScale, … |
| `evaluations` | id, patientId, inspection, posture, rangeOfMotion, muscleStrength, orthopedicTests, functionalDiagnosis, updatedAt |
| `treatment_plans` | id, patientId (unique), objectives, techniques, frequency, estimatedSessions, status |
| `evolutions` | id, patientId, **appointmentId** (optional FK), description, patientResponse, clinicalNotes, complications |
| `discharge_summaries` | id, patientId (unique), dischargeDate, **dischargeReason**, **achievedResults**, **recommendations** |
| `financial_records` | id, type (receita/despesa), amount, description, category, appointmentId?, patientId? |

### Schema push commands

```bash
# Via lib/db (workspace — used in Replit)
pnpm --filter @workspace/db run push

# Via root drizzle.config.ts (flat layout)
pnpm run db:push

# Seed with demo data
pnpm run db:seed
```

---

## API Routes

All routes require `Authorization: Bearer <token>` except `/api/auth/*` and `/api/healthz`.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create user |
| POST | `/api/auth/login` | Returns JWT |
| GET | `/api/auth/me` | Current user |

### Patients
| Method | Path | Description |
|---|---|---|
| GET | `/api/patients` | List with search + pagination |
| POST | `/api/patients` | Create |
| GET | `/api/patients/:id` | Detail + `totalAppointments` + `totalSpent` |
| PUT | `/api/patients/:id` | Update |
| DELETE | `/api/patients/:id` | Delete |

> `totalSpent` uses **LEFT JOIN** + OR condition to include both records with direct `patientId` and records linked via `appointmentId`. Only `receita` type records are counted.

### Medical Records (nested under `/api/patients/:patientId`)
| Method | Path | Description |
|---|---|---|
| GET/POST | `/anamnesis` | Upsert anamnesis |
| GET/POST | `/evaluations` | List / Create evaluation |
| PUT/DELETE | `/evaluations/:id` | Update / Delete evaluation |
| GET/POST | `/treatment-plan` | Upsert treatment plan |
| GET/POST | `/evolutions` | List / Create evolution |
| PUT/DELETE | `/evolutions/:id` | Update / Delete evolution |
| GET/POST | `/discharge-summary` | Upsert COFFITO discharge summary |
| GET | `/appointments` | Patient's appointment history |
| GET | `/financial` | Patient's financial records (LEFT JOIN) |

### Financial
| Method | Path | Description |
|---|---|---|
| GET | `/api/financial/dashboard` | Monthly KPIs |
| GET | `/api/financial/records` | List records (filter by type/month/year) |
| POST | `/api/financial/records` | Create record |

---

## Clinical Features (Prontuário — `patients/[id].tsx`)

The patient chart page (`artifacts/fisiogest/src/pages/patients/[id].tsx`) implements the full clinical record as tabbed sections:

| Tab | Component | Description |
|---|---|---|
| Anamnese | `AnamnesisTab` | Chief complaint, history, medications, pain scale (EVA) |
| Avaliações | `EvaluationsTab` | Physical evaluations — full CRUD with inline edit/delete |
| Plano de Tratamento | `TreatmentPlanTab` | Objectives, techniques, frequency, status |
| Evoluções | `EvolutionsTab` | Session notes — full CRUD, links to appointment via Select |
| Histórico | `HistoryTab` | All appointments (status, procedure, date) |
| Financeiro | `FinancialTab` | Revenue/expense history per patient |
| Alta Fisioterapêutica | `DischargeTab` | COFFITO-required discharge: reason, results, recommendations |

### Patient sidebar

Displays: name, phone, email, **age (calculated from birthDate)**, address, **profession**, **emergency contact**, CPF, clinical notes, total appointments, total spent.

---

## Scripts

### Root level

```bash
pnpm install                          # Install all workspace deps
pnpm dev                              # Start both services (correct ports for Replit)
pnpm run db:push                      # Sync schema (flat layout, dev only)
pnpm --filter @workspace/db run push  # Sync schema via lib/db (workspace)
pnpm run typecheck                    # tsc --noEmit (zero errors expected)
pnpm run db:seed                      # Seed demo data
```

### Per artifact

```bash
# Frontend
PORT=20408 API_PORT=8080 pnpm --filter @workspace/fisiogest run dev

# API Server
PORT=8080 pnpm --filter @workspace/api-server run dev
```

---

## Demo / Test Credentials

A test user is created on first run via the register endpoint:

- **Email**: `admin@test.com`
- **Password**: `admin123`

---

## Features

1. **Dashboard** — Today's appointments, monthly revenue, total patients, upcoming schedule
2. **Agenda** — Calendar with day/week/month views, appointment CRUD
3. **Pacientes** — Patient list with search/pagination, full prontuário with:
   - Anamnese (chief complaint, EVA pain scale)
   - Avaliações Físicas (CRUD with edit/delete)
   - Plano de Tratamento
   - Evoluções de Sessão (CRUD, links to appointment)
   - Histórico de Consultas
   - Financeiro do Paciente
   - **Alta Fisioterapêutica** (COFFITO — discharge reason, results, recommendations)
4. **Procedimentos** — CRUD for physiotherapy/aesthetics/pilates services with pricing
5. **Financeiro** — Revenue dashboard, expense tracking, monthly KPIs
6. **Relatórios** — Monthly revenue charts, procedure revenue, schedule occupation

---

## External Deployment (non-Replit)

For Hostinger / Railway / Render, use the **flat layout** at the root:

```bash
pnpm install && pnpm run build
PORT=8080 NODE_ENV=production node dist/server.cjs
```

The root `src/` + `server/` + `db/` directories contain a self-contained version of the app. The root `vite.config.ts` proxies `/api` to `API_PORT` (default 3001).

> The flat server layout (`server/routes/patients.ts`) mirrors the same LEFT JOIN fix for `totalSpent` as the artifacts version.

---

## Known Design Decisions

- **Evolutions do not have `updatedAt`** — evolution notes are append-only by clinical convention; edits are tracked by record replacement.
- **Financial `totalSpent` counts only `receita`** — the patient sidebar shows total revenue from that patient, not net of clinic expenses.
- **Discharge summary is unique per patient** — one discharge per patient (upsert), editable at any time.
- **`appointmentId` in evolutions is optional** — the physiotherapist may link an evolution to a scheduled appointment or leave it unlinked.
