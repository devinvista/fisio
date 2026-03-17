# FisioGest Pro

## Overview

FisioGest Pro is a complete clinical management SaaS platform for physiotherapy, aesthetics, and pilates clinics. Flat Vite + Express layout — one `package.json` at root, deployable to any Node.js host (Hostinger, Railway, Render).

## Stack

- **Node.js**: 24
- **Package manager**: pnpm
- **TypeScript**: 5.9
- **Frontend**: React 19 + Vite 7 + TailwindCSS v4 + shadcn/ui (new-york)
- **Backend**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod v3, drizzle-zod
- **API client**: Orval-generated React Query hooks (`src/lib/api/generated/`)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Charts**: Recharts
- **Icons**: Lucide React

## Demo Credentials

- **Email**: demo@fisiogest.com
- **Password**: demo123

## Flat Structure

```text
/
├── src/                        # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── pages/
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── dashboard.tsx
│   │   ├── agenda.tsx
│   │   ├── patients/index.tsx
│   │   ├── patients/[id].tsx
│   │   ├── procedimentos.tsx
│   │   ├── financial/index.tsx
│   │   └── relatorios.tsx
│   ├── components/
│   │   ├── layout/app-layout.tsx
│   │   └── ui/                 # shadcn/ui components
│   └── lib/
│       ├── auth-context.tsx
│       ├── utils.ts
│       └── api/
│           ├── index.ts
│           ├── custom-fetch.ts
│           └── generated/      # Orval-generated hooks & schemas
├── server/                     # Express backend
│   ├── index.ts                # Entry point (PORT env var)
│   ├── app.ts                  # Express app + static serving
│   ├── build.ts                # esbuild bundler → dist/server.cjs
│   ├── middleware/auth.ts      # JWT middleware
│   └── routes/
│       ├── index.ts
│       ├── health.ts           # GET /api/healthz
│       ├── auth.ts             # /api/auth/*
│       ├── patients.ts         # /api/patients/*
│       ├── procedures.ts       # /api/procedures/*
│       ├── appointments.ts     # /api/appointments/*
│       ├── medical-records.ts  # /api/patients/:id/...
│       ├── financial.ts        # /api/financial/*
│       ├── reports.ts          # /api/reports/*
│       └── dashboard.ts        # /api/dashboard
├── db/                         # Drizzle ORM
│   ├── index.ts                # pg Pool + drizzle client
│   └── schema/
│       ├── index.ts
│       ├── users.ts
│       ├── patients.ts
│       ├── procedures.ts
│       ├── appointments.ts
│       ├── medical-records.ts
│       └── financial.ts
├── package.json                # Single root package
├── vite.config.ts              # Vite: out=dist/public, proxy /api → :3001
├── tsconfig.json               # Frontend TS config (jsx: react-jsx, @/* → src/*)
├── tsconfig.server.json        # Server TS config
├── drizzle.config.ts           # Points to db/schema/index.ts
└── index.html                  # Vite entry point
```

## Dev Workflows

| Workflow | Command | Port |
|---|---|---|
| FisioGest: API Server | `PORT=3001 tsx server/index.ts` | 3001 |
| FisioGest: Web | `API_PORT=3001 PORT=3000 vite ...` | 3000 |

## Scripts

```bash
pnpm run build        # vite build → dist/public + esbuild → dist/server.cjs
pnpm run start        # node dist/server.cjs  (production)
pnpm run db:push      # drizzle-kit push (dev schema sync)
pnpm run typecheck    # tsc --noEmit
```

## Production Deployment

```bash
# Build
pnpm install && pnpm run build
# Start
PORT=8080 NODE_ENV=production node dist/server.cjs
```

The server serves the built frontend from `dist/public` and all `/api/*` routes from `dist/server.cjs`.

## Features

1. **Dashboard** — Today's appointments, monthly revenue, total patients, upcoming schedule
2. **Agenda** — Calendar with day/week/month views, appointment CRUD
3. **Pacientes** — Patient list, search, full detail with medical records tabs
4. **Prontuário Clínico** — Anamnese, Avaliação Fisioterapêutica, Plano de Tratamento, Evoluções
5. **Procedimentos** — CRUD for physiotherapy/aesthetics/pilates services
6. **Financeiro** — Revenue dashboard, expense tracking, financial records
7. **Relatórios** — Monthly revenue charts, procedure revenue, schedule occupation
