# Architecture

## Overview

ExamDump is a static‑frontend exam‑browser that proxes JSON exam data through a Cloudflare Worker, which fetches the data from a private GitHub repository (`ajayk134/exam-data` on branch `masked_main`).

## Components

### 1. Netlify Frontend (`frontend/`)

- **Hosting**: Netlify (`https://examdump.netlify.app`).
- **Entry point**: `index.html` (renamed from the original hashed `9f4c2e7a1d8b30c6.html` to fix the broken site root).
- **Configuration**: `config.js` sets `window.EXAMDUMP_API_BASE` (defaults to the Cloudflare Worker URL).
- **JavaScript bundles** (all read `window.EXAMDUMP_API_BASE`):
  - `index.js` – main login & provider flow; sends password via `X-Exam-Password` header to the Worker.
  - `exam_titles.js` – fetches unprotected exam list (`/provider/{exam}`) without authentication.
  - `practice_mode.js` – practice‑mode exam viewer; uses Puter.js AI integration; no auth.
  - `reading_mode.js` – read‑only exam viewer.
- **Login flow**: user enters a password in the UI; the password is stored in `sessionStorage` and then sent to the Worker as `X-Exam-Password` header on protected routes (`/index` and `/{subject}/exams`).
- **PII removed**: the footer phone number `+91 6301313335` has been removed.

### 2. Cloudflare Worker (`cloudflare-worker-exam/`)

- **Type**: Module Worker (`export default { fetch }`).
- **Live URL**: `https://exam.dumpsk134.workers.dev`.
- **Compatibility date**: `2025‑12‑31`; `workers_dev = true`.
- **Routes** (mapped to GitHub paths on branch `masked_main`):
  - `GET /index` → `data/index.json` – **protected**, requires `X-Exam-Password` header.
  - `GET /<subject>/exams` → `data/<subject>/exams.json` – **protected**.
  - `GET /<subject>/<exam>` → `data/<subject>/<exam>.json` – **unprotected**.
- **Authentication**: protected endpoints check `request.headers.get("X-Exam-Password")` against the secret `EXAM_PASSWORD` stored in Worker settings.
- **Upstream data source**: `https://raw.githubusercontent.com/ajayk134/exam-data/masked_main/...` using a GitHub token (`env.GITHUB_TOKEN`).
- **CORS**: `Access‑Control‑Allow‑Origin: *` with `Access‑Control‑Allow‑Headers: Content-Type, X-Exam-Password`.
- **Cache**: `Cache‑Control: public, max‑age=300`.
- **Local development**: `npm run dev` starts Wrangler; set `.dev.vars` with `GITHUB_TOKEN` and `EXAM_PASSWORD`. Do not commit `.dev.vars`.

### 3. Exam Data Repository (`exam-data/`)

- **Snapshot**: `masked_main` branch of `ajayk134/exam-data` (≈357 MB, 2045 files). This is the production data the Worker reads.
- **Structure** (top level):
  - `data/` – per‑provider folders (cisco, comptia, microsoft, fortinet, vmware, etc.).
  - Each folder contains JSON files for exam questions, choices, answers, and vote distributions.
- **Branch policy**: The `masked_main` branch has provider/exam keys **masked** (the branch was created specifically to “Mask provider and exam keys”). The `main` branch was excluded from the public repo.
- **Gitleaks**: 29 findings, all sample exam‑question credentials; no live secrets.

### 4. Data Flow (request lifecycle)

```
Browser (frontend)
  |
  |-- user enters password → sessionStorage → X-Exam-Password header
  |
  v
Cloudflare Worker (exam.dumpsk134.workers.dev)
  |
  |-- validates password → fetches from GitHub raw (masked_main)
  |
  v
raw.githubusercontent.com/ajayk134/exam-data/masked_main/...
  |
  v
JSON response (streamed, cached 300 s)
  |
  v
Browser renders exam
```

### 5. Deployment Pipeline (manual, not automated)

1. Edit `.dev.vars` (gitignored) with a read‑only GitHub token and a password.
2. `npm run dev` to test locally.
3. `npx wrangler secret put GITHUB_TOKEN` and `npx wrangler secret put EXAM_PASSWORD` on the Cloudflare dashboard.
4. `npm run deploy` (only after explicit approval; the recovered source has `workers_dev = true` and no routes/custom domains, matching the current live configuration).

## Files Overview

| Path | Purpose |
|------|---------|
| `frontend/index.html` | Root page; includes `config.js` before other scripts. |
| `frontend/config.js` | Sets `window.EXAMDUMP_API_BASE`. |
| `frontend/index.js` | Login flow; fetches `/index` with `X-Exam-Password` header. |
| `frontend/exam_titles.js` | Unprotected exam list fetch. |
| `frontend/practice_mode.js` | Practice‑mode viewer; Puter.ai integration. |
| `frontend/reading_mode.js` | Read‑only viewer. |
| `cloudflare-worker-exam/src/worker.js` | Sanitized Worker source (env vars only). |
| `cloudflare-worker-exam/wrangler.toml` | Worker configuration. |
| `cloudflare-worker-exam/package.json` | Local dev scripts. |
| `cloudflare-worker-exam/.dev.vars.example` | Required secret names (no values). |
| `exam-data/` | `masked_main` production data snapshot. |
| `docs/SECURITY.md` | Security audit and remediation steps. |
| `docs/ARCHITECTURE.md` | This file. |
| `docs/RECOVERY.md` | Provenance and sourcing details. |
| `docs/INVENTORY.md` | File counts and sizes. |