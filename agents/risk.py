#!/usr/bin/env python3
"""Non-legal risk gate for autonomous operations."""
from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'; OUT.mkdir(exist_ok=True)

BLOCKED_AUTOMATIONS = [
    'token sale',
    'exchange listing',
    'custody',
    'investment advice',
    'guaranteed returns',
    'automated token buying',
    'automated token selling',
    'market manipulation',
]


def main():
    result = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'status': 'human_review_required',
        'allowedAutonomy': [
            'public endpoint checks',
            'readiness scans',
            'receipt generation',
            'lead discovery without outreach',
            'draft content',
            'usage analytics',
            'testnet experiments'
        ],
        'humanGateRequired': BLOCKED_AUTOMATIONS,
        'instruction': 'This file is an operational guardrail, not legal advice.'
    }
    p = OUT / 'risk-gate.json'; p.write_text(json.dumps(result, indent=2)); print(json.dumps(result, indent=2))

if __name__ == '__main__': main()
