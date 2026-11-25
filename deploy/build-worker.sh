#!/usr/bin/env bash
# Bundle the worker into one JS file, build the image, and roll it out to the
# local cluster (OrbStack shares Docker images with Kubernetes).
set -euo pipefail
cd "$(dirname "$0")/.."
ESBUILD=$(ls -d node_modules/.pnpm/esbuild@0.2*/node_modules/esbuild/bin/esbuild | tail -1)
rm -rf apps/worker/out && mkdir -p apps/worker/out
"$ESBUILD" apps/worker/src/main.ts --bundle --platform=node --target=node24 --format=esm \
  --outfile=apps/worker/out/main.mjs --log-level=warning \
  --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"
docker build -q -t raktflow/voice-worker:local apps/worker

# Secret: only the keys the worker needs; APP_URL points at production so Sarvam webhooks reach Vercel.
ENV_FILE=$(mktemp)
trap 'rm -f "$ENV_FILE"' EXIT
python3 - "$ENV_FILE" <<'PY'
import sys
keep = {"DATABASE_URL","FLAGSMITH_SERVER_KEY","FLAGSMITH_ADMIN_API_KEY","FLAGSMITH_PROJECT_ID","FLAGSMITH_ENVIRONMENT_KEY",
        "FLAGSMITH_REFRESH_SECONDS","RAKTFLOW_API_KEY","SARVAM_API_KEY","SARVAM_VOICE_API_KEY","SARVAM_ORG_ID",
        "SARVAM_WORKSPACE_ID","SARVAM_APP_ID","SARVAM_APP_VERSION","SARVAM_CONNECTION_ID","SARVAM_AGENT_PHONE",
        "NUDGEBEE_RATELIMIT_WEBHOOK_URL"}
out = open(sys.argv[1], "w")
for line in open(".env.local"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        if k in keep and v:
            out.write(f"{k}={v}\n")
out.write("APP_URL=https://raktflow.vercel.app\n")
PY
kubectl apply -f deploy/k8s/namespace.yaml
kubectl -n raktflow create secret generic raktflow-env --from-env-file="$ENV_FILE" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f deploy/k8s/voice-worker.yaml
kubectl -n raktflow rollout restart deploy/voice-worker
kubectl -n raktflow rollout status deploy/voice-worker --timeout=120s
