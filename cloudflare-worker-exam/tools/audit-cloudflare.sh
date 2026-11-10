#!/usr/bin/env bash
# Read-only Cloudflare Workers audit. Usage:
#   doppler run --project agent-keys --config dev_personal -- bash tools/audit-cloudflare.sh
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"

API="https://api.cloudflare.com/client/v4"
BASE="${API}/accounts/${CLOUDFLARE_ACCOUNT_ID}"
OUT="${OUT_DIR:-.audit}"
AUTH_HEADER="Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"

umask 077
mkdir -p "${OUT}"
chmod 700 "${OUT}"

get() {
  curl -sS -H "${AUTH_HEADER}" "$1"
}

get_to() {
  curl -sS -H "${AUTH_HEADER}" -o "$2" -w "%{http_code}" "$1"
}

get_script() {
  curl -sS -D "$3" -H "${AUTH_HEADER}" -o "$2" -w "%{http_code}" "$1" > "$4"
}

echo "Read-only audit of account ${CLOUDFLARE_ACCOUNT_ID}"

get "${API}/user/tokens/verify" > "${OUT}/token-verify.json"
get "${BASE}/workers/subdomain" > "${OUT}/subdomain.json"
get "${BASE}/workers/routes" > "${OUT}/routes.json"
get "${BASE}/workers/domains" > "${OUT}/domains.json"
get "${BASE}/workers/scripts" > "${OUT}/scripts-list.json"
get "${BASE}/pages/projects" > "${OUT}/pages-projects.json"
get "${BASE}/storage/kv/namespaces" > "${OUT}/kv-namespaces.json"
get "${BASE}/d1/database" > "${OUT}/d1-databases.json"
get "${BASE}/queues" > "${OUT}/queues.json"
get_to "${BASE}/r2/buckets" "${OUT}/r2-buckets.json" > "${OUT}/r2-buckets.status" || true
get_to "${BASE}/workers/dispatch/namespaces" "${OUT}/dispatch-namespaces.json" > "${OUT}/dispatch-namespaces.status" || true

jq -r '.result[]?.id' "${OUT}/scripts-list.json" | while read -r script; do
  [ -n "${script}" ] || continue
  dir="${OUT}/${script}"
  mkdir -p "${dir}"
  chmod 700 "${dir}"

  get_script "${BASE}/workers/scripts/${script}" "${dir}/script-multipart.bin" "${dir}/script.headers" "${dir}/script.status"
  get "${BASE}/workers/scripts/${script}/settings" > "${dir}/settings.json"
  get "${BASE}/workers/scripts/${script}/secrets" > "${dir}/secrets.json"
  get "${BASE}/workers/scripts/${script}/schedules" > "${dir}/schedules.json"
  get "${BASE}/workers/scripts/${script}/deployments?per_page=100" > "${dir}/deployments.json"
  get "${BASE}/workers/scripts/${script}/versions?per_page=100" > "${dir}/versions.json"
  get "${BASE}/workers/services/${script}" > "${dir}/service.json" || true
  get "${BASE}/workers/services/${script}/environments/production" > "${dir}/service-production.json" || true

  version_id="$(jq -r '.result.items[0].id // empty' "${dir}/versions.json")"
  if [ -n "${version_id}" ]; then
    get "${BASE}/workers/scripts/${script}/versions/${version_id}" > "${dir}/version-current.json"
  fi

  if [ -s "${dir}/script-multipart.bin" ]; then
    python3 tools/parse_multipart.py "${dir}/script.headers" "${dir}/script-multipart.bin" "${dir}/parts" || true
  fi

  echo "Recovered ${script}: $(jq -r '.result.items | length' "${dir}/versions.json" 2>/dev/null || echo "?") versions"
done

echo "Audit data written to ${OUT}"
echo "This directory contains unsanitized source and must never be committed or shared."
