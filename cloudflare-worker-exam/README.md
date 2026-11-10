# Worker: `exam`

Authenticated read-through proxy for exam JSON data stored in a private GitHub repository.

* Live URL: <https://exam.dumpsk134.workers.dev>
* Worker type: module Worker (`export default { fetch }`)
* Compatibility date: `2025-12-31`
* Usage model: `standard`
* Runtime dependencies: none
* Bindings: none configured in production
* Routes / custom domains / cron: none

## Functionality

The Worker accepts HTTP `GET` requests, maps the URL path to a JSON file in the private repository `ajayk134/exam-data` on branch `masked_main`, fetches that file from `raw.githubusercontent.com` using a GitHub token, and returns it with CORS headers and a 300-second cache policy.

### Path mapping

| Request | Upstream path | Authentication |
| --- | --- | --- |
| `GET /index` | `data/index.json` | required |
| `GET /<subject>/exams` | `data/<subject>/exams.json` | required |
| `GET /<subject>/<exam>` | `data/<subject>/<exam>.json` | none |
| `OPTIONS *` | none | CORS preflight, `204` |
| non-`GET` | none | `405 Method Not Allowed` |
| any other path | none | `404 Not Found` |

Authentication succeeds when the supplied value equals the configured password. The original code accepted either the `X-Exam-Password` header or the `pw` query parameter. The recovered source keeps both for behavioral parity; SEC-004 recommends removing the query parameter.

### Response behavior

* CORS: `Access-Control-Allow-Origin: *`, methods `GET, OPTIONS`, allowed headers `Content-Type, X-Exam-Password`.
* Success: upstream body streamed through, `Content-Type: application/json`, `Cache-Control: public, max-age=300`.
* Upstream failure: `404 Data not found`.
* Unauthorized protected request: `401 Unauthorized.`
* Missing secret binding: `500 Server misconfigured.` (added during sanitization).

## Architecture

```
Browser / API client
        |
        | GET /index, /<subject>/exams, /<subject>/<exam>
        v
Cloudflare edge (exam.dumpsk134.workers.dev)
        |
        v
  exam Worker (module)
        |
        | path -> data/....json
        | Authorization: Bearer <GitHub token>
        v
raw.githubusercontent.com/ajayk134/exam-data/masked_main/...
        |
        v
  JSON response (streamed, cached 300s)
```

## Production configuration recovered

| Item | Value |
| --- | --- |
| Script tag | `506cd2d6dffb45649e907c38df475133` |
| ETag | `9b8a90a1adb415a8544b20ded909a3c8e85723767e9900f66a69734929364003` |
| Created | `2025-12-31T22:18:13.340623Z` |
| Last script metadata change | `2026-11-10T17:03:25.489949Z` |
| Last deployment | 2026-03-22T23:56:22.179744Z, deployment `64b3f033-3667-4045-9a28-f81fb1877813`, version 16 |
| Current version | `eaf941ba-9f7e-4166-ae4b-046afc2394b3` (number 16) |
| Deployments / versions | 16 / 16 |
| Bindings | none |
| Secret bindings | none |
| Routes | none |
| Custom domains | none |
| Schedules | none |
| Observability | enabled; logs persisted; query-string redaction disabled |

The Worker was last deployed from the Cloudflare dashboard (`quick_editor`) and has no local build metadata or repository linkage. `last_deployed_from` in the script summary is `quick_editor`.

Detailed API snapshots are in [`metadata/`](metadata/):

| File | Contents |
| --- | --- |
| `script-summary.json` | script list entry |
| `settings.json` | compatibility, bindings, observability, tail consumers |
| `service.json` | service and production environment |
| `secret-bindings.json` | secret names only (`[]`) |
| `routes.json` | normalized routes (`[]`) |
| `schedules.json` | cron schedules (`[]`) |
| `versions.json` | all 16 version records |
| `version-current.json` | current version detail and resources |
| `deployments.json` | all 16 deployment records |
| `token-permissions.json` | summary of the audit token's permissions |

## Local development

### Prerequisites

* Node.js 20 or newer (tested with Node.js 24)
* A GitHub token with read access to `ajayk134/exam-data`
* The exam password, or a new local password

### Setup

```bash
cd cloudflare-workers/exam
npm install
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```dotenv
GITHUB_TOKEN=<read-only GitHub token>
EXAM_PASSWORD=<local password>
```

`.dev.vars` is gitignored. Do not commit it.

### Run

```bash
npm run dev
```

Wrangler defaults to local mode. The local server prints a URL such as `http://127.0.0.1:8787`.

```bash
curl -i http://127.0.0.1:8787/index -H 'X-Exam-Password: <local password>'
curl -i http://127.0.0.1:8787/<subject>/<exam>
```

To run the Worker on Cloudflare's edge with remote resources, use `npm run dev:remote`. This still does not deploy code.

### Validate without deploying

```bash
npm run dry-run
```

This bundles the Worker and writes output to `dist/` without uploading.

### Deploy (do not run without approval)

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put EXAM_PASSWORD
npm run deploy
```

The recovered `wrangler.toml` has `workers_dev = true`, matching the current live hostname. It has no routes or custom domains because none exist in production.

## Recovery notes

The runnable source is [`src/worker.js`](src/worker.js). It is functionally equivalent to the recovered production script except for these deliberate changes:

1. The hardcoded GitHub token was removed from both locations and replaced with `env.GITHUB_TOKEN`.
2. The hardcoded password was removed and replaced with `env.EXAM_PASSWORD`.
3. Fail-closed checks return `500 Server misconfigured.` when either secret is absent.
4. Repository owner, name, and branch were extracted into constants with the original values.

The unsanitized original is restricted to `../.audit/exam/parts/worker.js` (mode `700`, gitignored). It contains live credentials. Do not copy, commit, or share it. Rotate those credentials as described in [../SECURITY-FINDINGS.md](../SECURITY-FINDINGS.md).

## Missing or incomplete

* Local secret values are not present.
* Access to the private upstream repository is unconfirmed (unauthenticated `404`).
* Historical version source code cannot be recovered from Cloudflare.
* No tests, linter, formatter, TypeScript configuration, or CI pipeline exists.
* No deployment provenance beyond the Cloudflare dashboard metadata.
* The original repository/commit that produced the script is unknown.
