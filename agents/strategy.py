#!/usr/bin/env python3
"""Weekly strategy agent based on local metrics and scout artifacts.
This is intentionally deterministic so it can operate at zero cash without an LLM.
"""
from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'artifacts'
DATA = ROOT / 'data'


def read_jsonl(path):
    if not path.exists(): return []
    return [json.loads(x) for x in path.read_text().splitlines() if x.strip()]


def main():
    events = read_jsonl(DATA / 'revenue.jsonl')
    receipts = read_jsonl(DATA / 'receipts.jsonl')
    gross = sum(float(e.get('usd', 0)) for e in events)
    services = {}
    for e in events:
        k = e.get('product', 'unknown')
        services[k] = services.get(k, 0) + float(e.get('usd', 0))
    report = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'revenue': {'grossUsd': round(gross, 2), 'byProduct': {k: round(v,2) for k,v in services.items()}},
        'proof': {'receiptCount': len(receipts)},
        'decisionRules': [
            'Keep the free scanner as the acquisition wedge.',
            'Prioritize whichever paid remediation item has the highest close rate.',
            'Do not deploy or market a token until product demand and legal review gates are satisfied.',
            'Prefer protocol adapters over protocol-specific rewrites.',
            'Retire features with repeated low usage after three review cycles unless strategically required.'
        ],
    }
    path = ART / f'strategy-{datetime.now(timezone.utc).strftime("%Y-%m-%d")}.json'
    path.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
