# CampaignOS

Bun workspace with an Elysia API for backend and agent logic, plus a React + Tailwind CSS frontend.

## Getting Started

```bash
bun install
bun run dev
```

- API: `http://localhost:3041` (set `API_PORT`; default avoids sharing `:3001` with other apps)
- Web: `http://localhost:5173`

If onboarding or file indexing returns **404**, check that **`API_PORT` and `VITE_API_URL` agree** (see `.env.example`). A stray `.env` or another service on `$VITE_API_URL` often causes the SPA to proxy requests to the wrong server.
## Scripts

```bash
bun run dev
bun run typecheck
bun run build
```

## Environment

Copy `.env.example` into `.env` and adjust values as needed.
