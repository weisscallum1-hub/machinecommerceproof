#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
DATA_DIR="${TMPDIR:-/tmp}/mcp-proof-demo-$$"
mkdir -p "$DATA_DIR"
cleanup() { rm -rf "$DATA_DIR"; }
trap cleanup EXIT
DATA_DIR="$DATA_DIR" node server/src/server.js &
pid=$!
trap 'kill "$pid" 2>/dev/null || true; cleanup' EXIT
sleep 1
curl -fsS http://localhost:4020/health | python -m json.tool
curl -fsS -X POST http://localhost:4020/v1/proof \
  -H 'content-type: application/json' \
  -d '{"agentId":"demo-agent","action":"quote_service","policy":"allowed","input":{"sku":"demo"},"output":{"price":39},"paymentId":"demo-x402"}' \
  | python -m json.tool
curl -fsS http://localhost:4020/v1/stats | python -m json.tool
