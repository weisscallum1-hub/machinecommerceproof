#!/usr/bin/env bash
set -euo pipefail

docker compose build

docker compose up -d
cleanup() { docker compose down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4020/health >/tmp/mcp-health.json 2>/dev/null; then
    break
  fi
  sleep 1
done

curl -fsS http://127.0.0.1:4020/health >/dev/null
curl -fsS http://127.0.0.1:4020/.well-known/agent-card.json >/dev/null
curl -fsS http://127.0.0.1:4020/v1/stats >/dev/null
printf '%s\n' 'docker smoke: PASS'
