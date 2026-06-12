#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${CLOUDFLARE_PAGES_PROJECT:-dietz-engineering-website}"
BRANCH_NAME="${CLOUDFLARE_PAGES_BRANCH:-main}"

cd "$(dirname "$0")/.."

echo "== DIETZ Cloudflare Pages Deploy =="
echo "Project: ${PROJECT_NAME}"
echo "Branch:  ${BRANCH_NAME}"
echo

echo "1/4 Build"
npm run build

echo
echo "2/4 Smoke tests"
for test_file in \
  chatbot_assistant_smoke.test.js \
  assistant_hybrid_contract_smoke.test.js \
  assistant_operator_persistence_smoke.test.js \
  operator_reply_page_smoke.test.js \
  formal_herr_dietz_copy_smoke.test.js \
  assistant_telegram_handoff_smoke.test.js \
  aria_project_files_smoke.test.js \
  customer_care_portal_smoke.test.js \
  eplan_showcase_image_smoke.test.js
  do
    echo "--- ${test_file}"
    node "${test_file}"
  done

echo
echo "3/4 Wrangler auth check"
set +e
npx wrangler whoami >/tmp/dietz-wrangler-whoami.log 2>&1
whoami_exit=$?
set -e
cat /tmp/dietz-wrangler-whoami.log
if [ "$whoami_exit" -ne 0 ] || grep -qi "not authenticated\|CLOUDFLARE_API_TOKEN" /tmp/dietz-wrangler-whoami.log; then
  echo
  echo "Wrangler ist nicht eingeloggt. Einmal lokal ausführen:"
  echo "  npx wrangler login"
  echo "Alternativ lokal CLOUDFLARE_API_TOKEN setzen. Keine Tokens per Chat senden."
  echo "Danach dieses Script erneut starten."
  exit 2
fi

echo
echo "4/4 Deploy _site/ to Cloudflare Pages"
npx wrangler pages deploy _site --project-name "${PROJECT_NAME}" --branch "${BRANCH_NAME}"

echo
echo "Deploy ausgelöst. Danach in Cloudflare Pages die Custom Domain verbinden und live prüfen."
