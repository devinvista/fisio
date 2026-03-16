# FisioGest Pro Workspace

## Overview

FisioGest Pro is a complete clinical management SaaS platform for physiotherapy, aesthetics, and pilates clinics. Built as a pnpm monorepo with React + Vite frontend and Express backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Charts**: Recharts
- **Icons**: Lucide React

## Demo Credentials

- **Email**: demo@fisiogest.com
- **Password**: demo123

## Features

1. **Dashboard** — Today's appointments, monthly revenue, total patients, upcoming schedule
2. **Agenda** — Calendar with day/week/month views, appointment CRUD
3. **Pacientes** — Patient list, search, full detail with medical records tabs
4. **Prontuário Clínico** — Anamnese, Avaliação Fisioterapêutica, Plano de Tratamento, Evoluções por sessão
5. **Procedimentos** — CRUD for physiotherapy/aesthetics/pilates services with pricing and margin
6. **Financeiro** — Revenue dashboard, expense tracking, financial records
7. **Relatórios** — Monthly revenue charts, procedure revenue table, schedule occupation stats

## Structure

```text
artifacts/
├── api-server/         # Express 5 REST API
│   └── src/
│       ├── middleware/auth.ts      # JWT auth middleware
│       └── routes/
│           ├── auth.ts            # POST /auth/register, /auth/login, GET /auth/me
│           ├── patients.ts        # CRUD /patients
│           ├── procedures.ts      # CRUD /procedures
│           ├── appointments.ts    # CRUD /appointments + /complete
│           ├── medical-records.ts # anamnesis, evaluations, treatment-plan, evolutions
│           ├── financial.ts       # /financial/dashboard, /financial/records
│           ├── reports.ts         # /reports/monthly-revenue, /procedure-revenue, /schedule-occupation
│           └── dashboard.ts       # GET /dashboard
└── fisiogest/           # React + Vite frontend (served at /)
    └── src/
        ├── pages/
        │   ├── login.tsx
        │   ├── register.tsx
        │   ├── dashboard.tsx
        │   ├── agenda.tsx
        │   ├── patients/index.tsx
        │   ├── patients/[id].tsx
        │   ├── procedimentos.tsx
        │   ├── financial/index.tsx
        │   └── relatorios.tsx
        ├── components/layout/app-layout.tsx
        └── lib/auth-context.tsx

lib/
├── api-spec/openapi.yaml    # Full API specification
├── api-client-react/        # Generated React Query hooks
├── api-zod/                 # Generated Zod schemas
└── db/src/schema/           # Drizzle ORM schema
    ├── users.ts
    ├── patients.ts
    ├── procedures.ts
    ├── appointments.ts
    ├── medical-records.ts   # anamnesis, evaluations, treatment_plans, evolutions
    └── financial.ts
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Database

Production migrations are handled by Replit when publishing. In development:
- `pnpm --filter @workspace/db run push` — push schema to dev DB
- `pnpm --filter @workspace/db run push-force` — force push (loses data)

## API

Run codegen after changing `lib/api-spec/openapi.yaml`:
```
pnpm --filter @workspace/api-spec run codegen
```
