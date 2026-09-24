#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$ROOT/agents/risk.py"
python3 "$ROOT/agents/readiness.py" "${1:-http://localhost:4020}"
python3 "$ROOT/agents/revenue.py"
python3 "$ROOT/agents/strategy.py"
