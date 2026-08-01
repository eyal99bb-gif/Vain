# Vain

Next.js 16 app hosting three surfaces:

| Route | What |
|---|---|
| `/` | **MIDA** — virtual try-on: "תמדוד לפני שאתה קונה" |
| `/studio` | Studio Vain marketing landing page |
| `/trading` | Quant trading dashboard (`src/lib/quant`) |

## MIDA — Virtual Try-On (Phase 1 MVP)

Build a body profile (photos + measurements) → paste any product URL →
see the garment on your avatar (Gemini `gemini-2.5-flash-image`) → get a
deterministic size recommendation crossed against the store's size chart.
Hebrew RTL, mobile-first.

### Demo mode (zero configuration)

Runs end-to-end without any env vars:

```bash
npm install
npm run dev        # open http://localhost:3000
```

Missing credentials activate fallbacks — canned avatar/try-on images,
JSON-file persistence (`.data/mida-db.json`), local-disk uploads
(`.data/uploads/`), and a fixture product when a store can't be scraped.

### Going live

Copy `.env.example` to `.env.local` and fill in any subset:

| Vars | Enables |
|---|---|
| `GEMINI_API_KEY` | Real avatar + try-on generation, LLM product extraction |
| `DATABASE_URL` (or `POSTGRES_URL`) | Postgres persistence via Drizzle — tables auto-created on first use |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob object storage (set automatically by Vercel) |
| `S3_ENDPOINT` + `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` + `S3_BUCKET` | S3/R2 object storage (optional `S3_PUBLIC_URL` for CDN) |

**Deploying to Vercel:** serverless filesystems are read-only, so the
file/disk demo fallbacks don't apply there — connect a **Neon Postgres**
database and a **Blob store** from the project's Storage tab (both inject
their env vars automatically), plus `GEMINI_API_KEY`, then redeploy.
Photos are downscaled client-side to stay under Vercel's 4.5MB body limit.

Each concern switches independently — adapters in
`src/lib/mida/adapters/{ai,db,storage}` pick real vs demo per env var.

### Architecture

```
src/lib/mida/
  env.ts              env parsing + mode flags
  uid.ts              anonymous httpOnly-cookie identity (auth seam)
  adapters/ai         Gemini / demo (prompts in prompts.ts)
  adapters/db         Drizzle Postgres / JSON file (schema.ts is the contract)
  adapters/storage    S3-compatible / local disk
  scraper/            fetch → JSON-LD → OpenGraph → size-chart tables →
                      LLM fallback → fixture (stores/registry.ts = per-store seam)
  sizing/             deterministic size recommendation (no AI), Hebrew output
  services/           orchestration used by route handlers
  jobs.ts             after()-based post-response jobs (queue seam)
src/app/(mida)/       landing, onboarding wizard, try-on flow
src/app/api/mida/     profile, photos, avatar, products, tryons
```

Try-ons run async: `POST /api/mida/tryons` returns `202` immediately with
the size recommendation (pure function), the image generates post-response
via `after()`, and the client polls `GET /api/mida/tryons/[id]`.

### Scripts

```bash
npm run dev          # dev server (Turbopack)
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test:mida    # sizing + scraper unit tests (tsx, assert-based)
npm run test:quant   # quant library tests
npm run db:push      # apply Drizzle schema to DATABASE_URL
```
