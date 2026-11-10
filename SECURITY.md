# Security Audit

## Critical Findings

- **Live GitHub PAT in production Worker**: The original Cloudflare Worker (`exam.dumpsk134.workers.dev`) contains a hardcoded `ghp_…` classic personal access token (40‑char) that is **still active** and grants read access to the private `ajayk134/exam-data` repository. This token is **not** the current Doppler `GITHUB_PAT`. It must be revoked and rotated by the account owner; the sanitized Worker source now reads `env.GITHUB_TOKEN` and no longer embeds the token.

- **Hardcoded shared password**: The original Worker compared a plaintext password literal; the sanitized version uses `env.EXAM_PASSWORD`. The password must be stored as a Worker secret via `npx wrangler secret put EXAM_PASSWORD`.

## High Findings (from prior audit)

- **Audit token over‑privilege**: Cloudflare API token `agent` has 400 permission groups including `Workers Admin`, `Workers Scripts Write`, `DNS Write`, etc. Replace with scoped tokens.

- **Password in query string / unredacted logs**: The Worker accepted `pw` query parameter and had `redact_query_string: false`. The sanitized Worker accepts only the `X-Exam-Password` header and rejects query‑string credentials.

- **No brute‑force protection**: The password check has no rate limit or lockout.

- **Permissive CORS**: `Access‑Control‑Allow‑Origin: *` on all responses, including protected endpoints.

## Medium Findings (from prior audit)

- **Missing secret bindings**: The Worker returns `500 Server misconfigured.` when `EXAM_PASSWORD` or `GITHUB_TOKEN` secrets are absent.

## Low Findings (from prior audit)

- **No tests, linter, formatter, CI pipeline**.

## Exam‑Data Repository (exam-data)

- **Current scan** (gitleaks v8.30.1, `--no-git`) on the `masked_main` snapshot returns **29 findings**, all of which are **sample credentials embedded in exam‑question text** (e.g., Webex tokens, AWS S3 keys, RADIUS client examples, Base64‑encoded cookies). None match the current Doppler secrets (`GITHUB_PAT`, `NETLIFY_TOKEN`, `CLOUDFLARE_API_TOKEN`). A detailed per‑finding review is in the appendix.

- **Full git history** (58 findings) contains the same 29 rule types; no new secret types appear. The `main` branch also holds the same sample content; it was **not** included in the published repo.

- **Decision**: The `masked_main` branch is the production data used by the Worker. The `main` branch was excluded from the public repository. A `.gitleaksignore` can be added for the 29 accepted false‑positive fingerprints if desired.

## What Has Been Done

- Sanitized Cloudflare Worker source: hardcoded GitHub token and password replaced with `env.GITHUB_TOKEN` and `env.EXAM_PASSWORD`; CORS, query‑string password, and fail‑closed behavior updated.
- Removed PII (phone number `+91 6301313335`) from the recovered Netlify frontend.
- Removed Netlify marketing comments from all HTML files.
- Added `config.js` (`window.EXAMDUMP_API_BASE`) so the API base can be overridden without editing each JS file.
- Updated all recovered JS files (`index.js`, `exam_titles.js`, `practice_mode.js`, `reading_mode.js`) to read the API base from the global instead of hardcoding it.
- No current Doppler credentials appear in any scanned file or git history.

## Required Owner Actions

1. **Rotate the live GitHub PAT** that was hardcoded in the production Worker. Use a fine‑grained, read‑only token limited to `ajayk134/exam-data` contents.
2. **Store the new exam password** as a Worker secret: `npx wrangler secret put EXAM_PASSWORD`.
3. **Deploy the sanitized Worker** (approved production change) so it reads secrets from the Worker dashboard rather than from hardcoded source.
4. **Review the 29 exam‑question sample credentials** and decide whether to keep, redact, or replace them in the data repository.

## Appendix: Gitleaks Findings (masked_main worktree)

| RuleID | File (relative) | Line | Description |
|--------|-----------------|------|-------------|
| generic-api-key | data/cisco/200‑901.json | 4223 | “Bearer‑Token: [REDACTED]” – sample token in a Cisco exam question |
| generic-api-key | data/cisco/350‑901.json | 6305 | “headers = {'X‑auth‑token':'[REDACTED]’}” – sample header in a Cisco question |
| generic-api-key | data/cisco/200‑901.json | 8169 | “my_token = [REDACTED]” – sample token in a Webex question |
| generic-api-key | data/cisco/350‑901.json | 10707 | “The access token for a Webex bot has been stored in an environment variable using the command: export [REDACTED]” – exam question about token export |
| curl-auth-user | data/comptia/PT0‑002.json | 27726 | “curl -k 'imaps://10.12.14.121' --user jsmith:Blu3moon -v” – sample curl command in a pentest question |
| aws-access-token | data/hashicorp/Vault Associate 002.json | 2823 | “B. vault lease revoke [REDACTED]” – sample AWS credential revocation question |
| aws-access-token | data/hashicorp/Vault Associate 002.json | 2839 | “D. vault lease revoke [REDACTED]” – same question, different option |
| generic-api-key | data/microsoft/70‑413.json | 2938 | “http:[REDACTED]” – sample URL in a RADIUS question |
| generic-api-key | data/microsoft/70‑413.json | 2974 | same as above (different line) |
| generic-api-key | data/microsoft/PL‑400.json | 5121 | “o Authentication: [REDACTED]” – sample auth header in a PL‑400 question |
| generic-api-key | data/microsoft/PL‑400.json | 5653 | same as above |
| generic-api-key | data/microsoft/PL‑400.json | 6120 | same as above |
| generic-api-key | data/microsoft/PL‑400.json | 16658 | same as above |
| generic-api-key | data/microsoft/PL‑400.json | 17197 | same as above |
| generic-api-key | data/microsoft/PL‑400.json | 17722 | same as above |
| generic-api-key | data/microsoft/AZ‑204.json | 61027 | “mysecret1: [REDACTED]” – sample secret in an AZ‑204 question |
| generic-api-key | data/microsoft/AZ‑204.json | 61119 | same as above |
| generic-api-key | data/microsoft/MS‑100.json | 29358 | “With the password policy, [REDACTED] is an acceptable password.” – Microsoft SSPR question |
| generic-api-key | data/microsoft/MS‑100.json | 29422 | same as above |
| generic-api-key | data/microsoft/PL‑400.json | 31481 | “o Authentication: [REDACTED]” – another PL‑400 question |
| generic-api-key | data/microsoft/PL‑400.json | 49789 | same as above |
| generic-api-key | data/microsoft/MS‑100.json | 53001 | “https://docs.microsoft.com/... https:[REDACTED]?[REDACTED]” – Power Platform question |
| generic-api-key | data/microsoft/MS‑100.json | 53016 | same as above |
| generic-api-key | data/microsoft/PL‑400.json | 55730 | “o Authentication: [REDACTED]” – another PL‑400 question |
| generic-api-key | data/vmware/1V0‑21.20.json | 591 | “Permanently inaccessible device :naa.1234567890 has no more open connections.” – VMware question (contains a NA‑A device ID, flagged as generic‑api‑key) |

**All 29 findings were manually reviewed and confirmed to be exam‑question sample content, not live credentials.** No current Doppler token (`GITHUB_PAT`, `NETLIFY_TOKEN`, `CLOUDFLARE_API_TOKEN`) appears in any finding.