> Test: kick off CI + AI review

Nimbus Finance (Monorepo)
=========================

Nimbus Finance is a premium financial SaaS targeting the German market with a world-class CSV parsing experience and competitive pricing.

Packages
--------
- `backend`: Node.js + Express + Prisma (SQLite in development)
- `web`: React + TypeScript + Vite + Tailwind
- `shared`: Shared types and utilities for web + backend

Quick Start (Development)
------------------------

1) Install dependencies (Node 18+ recommended):

```bash
npm install
```

2) Database (SQLite by default):

SQLite is used for local development. No Docker required.

3) Configure backend environment:

```bash
copy backend/env.example backend/.env  # PowerShell
# Then edit backend/.env if needed
```

4) Generate Prisma client and create the SQLite database:

```bash
npm run prisma:generate
npm --workspace backend exec prisma db push
```

5) Start both backend and web in dev mode:

```bash
npm run dev
```

- Backend: http://localhost:4000
- Web: http://localhost:5173

GitHub Repository (Private)
---------------------------

Create a private GitHub repo named `nimbus-finance` and push:

```bash
git init
git add .
git commit -m "chore: initial monorepo scaffold"
# Requires GitHub CLI (gh) and that you're logged in
gh repo create nimbus-finance --private --source . --remote origin
git branch -M main
git push -u origin main
```

Environments
------------
- Local: SQLite at `backend/prisma/dev.db`
- Backend config in `backend/.env`

Scripts
-------
- `npm run dev` — runs backend and web concurrently
- `npm run prisma:generate` — generate Prisma client
- `npm run prisma:migrate` — run a new database migration

API
---
- `GET /api/transactions.csv` — export transactions as CSV (supports `limit`, `dateFrom`, `dateTo`)

Tech Stack
---------
- Frontend: React, TypeScript, Tailwind, Vite
- Backend: Node.js, Express, Prisma, PostgreSQL
- Payments: Stripe (Phase 3)
- Hosting: Vercel (web), Railway (backend)


