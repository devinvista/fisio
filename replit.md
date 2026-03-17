# FisioGest Pro

## Overview

FisioGest Pro is a complete clinical management SaaS platform for physiotherapy, aesthetics, and pilates clinics.

The project is a **pnpm workspace monorepo** hosted on Replit. It is split into two artifacts (frontend + API) that are served through Replit's shared reverse proxy on port 80.

---

## Stack

- **Node.js**: 24
- **Package manager**: pnpm (workspace)
- **TypeScript**: 5.9
- **Frontend** (`artifacts/fisiogest`): React 19 + Vite 7 + TailwindCSS v4 + shadcn/ui (new-york)
- **Backend** (`artifacts/api-server`): Express 5
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Validation**: Zod v3, drizzle-zod (`lib/api-zod`)
- **API client**: Orval-generated React Query hooks (`lib/api-client-react`)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Charts**: Recharts
- **Icons**: Lucide React

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
│   │   │   │   ├── login.tsx
│   │   │   │   ├── register.tsx
│   │   │   │   ├── dashboard.tsx
│   │   │   │   ├── agenda.tsx
│   │   │   │   ├── patients/
│   │   │   │   ├── procedimentos.tsx
│   │   │   │   ├── financial/
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
│   │   │   ├── middleware/auth.ts
│   │   │   └── routes/
│   │   │       ├── index.ts
│   │   │       ├── health.ts           # GET /api/healthz
│   │   │       ├── auth.ts             # /api/auth/*
│   │   │       ├── patients.ts
│   │   │       ├── procedures.ts
│   │   │       ├── appointments.ts
│   │   │       ├── medical-records.ts
│   │   │       ├── financial.ts
│   │   │       ├── reports.ts
│   │   │       └── dashboard.ts
│   │   ├── build.ts
│   │   └── .replit-artifact/artifact.toml
│   │
│   └── mockup-sandbox/                 # UI prototyping sandbox
│
├── lib/
│   ├── db/                             # @workspace/db — Drizzle ORM + schema
│   │   ├── index.ts                    # pg Pool + drizzle client
│   │   ├── schema/
│   │   └── drizzle.config.ts
│   ├── api-zod/                        # @workspace/api-zod — Zod validation schemas
│   ├── api-client-react/               # @workspace/api-client-react — React Query hooks
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
├── drizzle.config.ts                   # Points to db/schema (for root-level flat layout)
└── .replit                             # Workflow + artifact config
```

---

## Scripts

### Root level

```bash
pnpm install                          # Install all workspace deps
pnpm dev                              # Start both services (correct ports for Replit)
pnpm run db:push                      # Sync schema (flat layout, dev only)
pnpm --filter @workspace/db run push  # Sync schema via lib/db (workspace)
pnpm run typecheck                    # tsc --noEmit
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
3. **Pacientes** — Patient list, search, full detail with medical records tabs
4. **Prontuário Clínico** — Anamnese, Avaliação Fisioterapêutica, Plano de Tratamento, Evoluções
5. **Procedimentos** — CRUD for physiotherapy/aesthetics/pilates services
6. **Financeiro** — Revenue dashboard, expense tracking, financial records
7. **Relatórios** — Monthly revenue charts, procedure revenue, schedule occupation

---

## External Deployment (non-Replit)

For Hostinger / Railway / Render, use the **flat layout** at the root:

```bash
pnpm install && pnpm run build
PORT=8080 NODE_ENV=production node dist/server.cjs
```

The root `src/` + `server/` + `db/` directories contain a self-contained version of the app. The root `vite.config.ts` proxies `/api` to `API_PORT` (default 3001).
