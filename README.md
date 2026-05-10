# CampaignOS

**Autonomous influencer marketing:** describe a campaign once, and CampaignOS helps discover creators, score fit with your objectives, draft outreach, and surface optimizations — powered by a LangGraph agent pipeline, brand-document retrieval (Nia), and creator metrics (Reacher).

Built as a **Bun monorepo**: a React + Tailwind dashboard (`apps/web`) and an Elysia API (`apps/api`) that runs the campaign intelligence graph.

---

## Features (demo flow)

1. **Onboarding** — Campaign brief via `CampaignIntakeForm` (optional brand file uploads when Nia is configured).
2. **Agent run** — LangGraph pipeline: normalize brief → retrieve document context → fetch creator metrics → run scorers → strategist → attribution reasoning → recommendations → composed report.
3. **Dashboard** — View report, tiers, drafts, and insights in `CampaignDashboard`.
4. **Outreach** — Batch outreach endpoint integrates with Reacher when keys are present (`/api/outreach/batch`).

---

## Tech stack

- **Runtime & tooling:** [Bun](https://bun.sh/), TypeScript
- **API:** [Elysia](https://elysiajs.com/), CORS
- **Agent:** [LangGraph](https://langchain-ai.github.io/langgraphjs/) + [@langchain/openai](https://js.langchain.com/)
- **Knowledge:** [Nia](https://trynia.ai/) (`nia-ai-ts`) for ingesting brand files
- **Creator data:** Reacher API for metrics / outreach
- **Frontend:** React 19, Vite 8, Tailwind CSS 4

---

## Quick start (judges)

### Prerequisites

- [Bun](https://bun.sh/) installed (`bun --version`)

### 1. Install

```bash
bun install
```

### 2. Environment

Copy the example env to the **repository root** (the API loads `../../.env`):

```bash
cp .env.example .env
```

Fill in at minimum:

- **`OPENAI_API_KEY`** — required for the campaign agent
- **`REACHER_API_KEY`** — creator metrics and outreach (use mock/reduced scope if your hackathon rules allow)
- **`NIA_API_KEY`** — optional; without it, document ingestion is disabled but much of the UI/agent path still runs

See `.env.example` for all variables and defaults (`API_PORT`, `OPENAI_MODEL`, Reacher base URL, etc.).

### 3. Run locally

**Standard dev** (API + web):

```bash
bun run dev
```

- **API:** `http://localhost:3041` (override with `API_PORT`)
- **Web:** `http://localhost:5173` (override with `WEB_PORT`)

**Hackathon demo preset** (loads bundled demo fixture on the intake screen once):

```bash
bun run demo
```

(`VITE_ENABLE_DEMO=1` plus the same concurrent API/web servers.)

### 4. Sanity checks

```bash
curl -s http://localhost:3041/health
```

Expect JSON with `"ok": true` and `"service": "campaign-os-api"`.

Other useful commands:

```bash
bun run typecheck
bun run build
```

---

## How the web app talks to the API

Vite proxies **`/api`** to `VITE_API_URL` (default `http://localhost:3041`). Keep **`API_PORT` and `VITE_API_URL` in sync** — if the SPA proxies to the wrong host/port, you may see **404** on ingest or agent calls even when the UI loads.

---

## API overview

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness |
| `POST` | `/api/agent/run` | Run campaign agent (JSON body: intake payload or legacy prompt shape) |
| `POST` | `/api/agent/run/stream` | Same pipeline with **NDJSON** progress events |
| `POST` | `/api/nia/ingest`, `/api/nia/upload` | Upload brand files for Nia indexing (`NIA_API_KEY` required) |
| `POST` | `/api/outreach/batch` | Batch outreach (Reacher-backed when configured) |

---

## Repository layout

```
apps/
  api/     # Elysia server, LangGraph campaign graph, Nia + Reacher integrations
  web/     # Vite + React + Tailwind dashboard
.env.example
```

---

## Troubleshooting

- **404 on `/api/...`** — Start `bun run dev:api` (or full `bun run dev`) and confirm `VITE_API_URL` matches the API’s URL/port.
- **Nia ingest returns 503** — Set `NIA_API_KEY` in `.env` at repo root.
- **Agent errors** — Confirm `OPENAI_API_KEY` and that your chosen `OPENAI_MODEL` is available on your account.

---

## License / hackathon

Private hackathon project (`"private": true` in `package.json`). Adjust licensing if you open-source after the event.
