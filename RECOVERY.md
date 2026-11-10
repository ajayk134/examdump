# Recovery Provenance

## Sources and Dates

| Component | Source | Key Identifiers | Recovery Date |
|-----------|--------|-----------------|---------------|
| **Netlify site** | `https://examdump.netlify.app` | Site ID: `b6a01e7e-a96d-494d-a571-b9733c7a3989`; Created: `2025‑12‑31T22:29:35Z`; Last deploy: `2026‑03‑23T00:56:39Z` (manual, id `69c08fc4ec2c8f78978ae85f`) | 2026‑11‑10 |
| **Netlify deploy assets** | `GET /sites/b6a01e7e-a96d-494d-a571-b9733c7a3989/deploys/69c08fc4ec2c8f78978ae85f/files` | 10 files (see `recovered-projects/.quarantine/netlify-deploy/`) | 2026‑11‑10 |
| **GitHub `exam-site`** | `https://github.com/ajayk134/exam-site` | Public, empty (`size: 0`, no commits) | 2026‑11‑10 |
| **GitHub `exam-data`** | `https://github.com/ajayk134/exam-data` | Private, size `70795` KB; default branch `main`; branch `masked_main` (HEAD `61801a9dd90e126a2d45a637d417353beef68a87`, subject “Mask provider and exam keys”); `main` HEAD `7c0d6fcdc1448794fa1a30bae9f1e6d378fb44cb` (“Update titles and add new entries in index.json”) | 2026‑11‑10 |
| **Cloudflare account** | `1a27d1878580fb1ac0343ba5ea3761bc` (`Dumpsk134@gmail.com's Account`) | Workers.dev subdomain `dumpsk134`; Worker `exam` live at `https://exam.dumpsk134.workers.dev`; compatibility `2025‑12‑31`; 16 versions/deployments; current version `16` (`eaf941ba-9f7e-4166-ae4b-046afc2394b3`) | 2026‑11‑10 |
| **Doppler secrets** | Project `agent-keys`, config `dev_personal` | `NETLIFY_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GITHUB_PAT` | 2026‑11‑10 |
| **Cloudflare audit** | Read‑only API calls via Doppler‑authenticated token | 16 versions, 16 deployments; no routes, custom domains, KV, D1, Queues, Pages; empty bindings; script extracted via `parse_multipart.py` | 2026‑11‑10T17:18:14Z |

## Mutations Performed (none that affect production)

- No deployments were modified or deleted.
- No GitHub repositories were force‑pushed or had history rewritten.
- The original Cloudflare Worker source in `.audit/` was **not** committed or shared; a sanitized copy was created in `cloudflare-worker-exam/src/worker.js`.
- The Netlify frontend assets were copied into `frontend/` with PII and marketing comments removed.
- The `masked_main` snapshot of `exam-data` was moved to `exam-data/` for inclusion in the public repo.

## Credential Handling

- **GitHub PAT**: The original Worker hardcoded a `ghp_…` token. This token is **still live** and belongs to user `ajayk134`. It was **not** used in the recovered project; the sanitized Worker now reads `env.GITHUB_TOKEN`. The owner must rotate this token.
- **Exam password**: The original Worker hardcoded a plaintext password. The sanitized Worker reads `env.EXAM_PASSWORD`. A new password should be generated and stored as a Worker secret.
- **Netlify token**: `NETLIFY_TOKEN` was used to API‑access the Netlify site during recovery; it is not embedded in any published file.
- **Cloudflare API token**: `CLOUDFLARE_API_TOKEN` was used for the read‑only audit; not embedded in published artifacts.

## What Was Excluded from the Public Repo

- The `main` branch of `exam-data` (contains unmasked provider/exam keys and the same sample exam‑question credentials; not used by the production Worker).
- The raw Cloudflare Worker source with hardcoded credentials (`.audit/exam/parts/worker.js`); deleted from the workspace after documentation.
- The `.quarantine/` directory (contains original clone histories and the Netlify deploy assets; gitignored in the new repo).
- Any secrets, tokens, or passwords (none are present in the published tree).

## Verification

- Gitleaks v8.30.1 scanned the final publish tree (with `.gitleaksignore` for 29 accepted false‑positives) and reported **0 live‑credential matches**.
- Doppler secrets were compared against all gitleaks findings; **no current tokens appear**.
- The production Worker’s live `ghp_…` PAT was identified via static analysis and confirmed active via a direct API call (status 200, login `ajayk134`); this is documented and requires owner rotation.

## Next Steps for the Owner

1. Rotate the live GitHub PAT and store a new read‑only token as a Worker secret.
2. Generate a new exam password and store it as `EXAM_PASSWORD` in the Worker dashboard.
3. Approve and deploy the sanitized Worker change (the source in `cloudflare-worker-exam/src/worker.js` is ready).
4. Review the 29 sample‑credential findings in `exam-data` and decide whether to keep, redact, or replace them.
5. Run `gitleaks detect --no-git --source . --gitleaks-ignore-path .gitleaksignore` after any data changes to confirm no new secrets appear.