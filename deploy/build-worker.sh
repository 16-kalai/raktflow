#!/usr/bin/env bash
# Bundle the worker with its workspace deps, build the image, load it into the
# local cluster (OrbStack shares Docker images with Kubernetes) and roll out.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf apps/worker/out
pnpm --filter @raktflow/worker deploy --legacy apps/worker/out/worker
docker build -t raktflow/voice-worker:local apps/worker
kubectl apply -f deploy/k8s/namespace.yaml
kubectl -n raktflow create secret generic raktflow-env --from-env-file=.env.local --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f deploy/k8s/voice-worker.yaml
kubectl -n raktflow rollout restart deploy/voice-worker
kubectl -n raktflow rollout status deploy/voice-worker --timeout=120s
