#!/usr/bin/env python3
"""Revenue calculator using local JSON events; no custody or trading."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
EVENTS = ROOT / 'data' / 'revenue.jsonl'

def main():
    total = 0.0
    count = 0
    if EVENTS.exists():
        for line in EVENTS.read_text().splitlines():
            if not line.strip(): continue
            e = json.loads(line); total += float(e.get('usd',0)); count += 1
    print(json.dumps({'events':count,'grossUsd':round(total,2),'targetUsdPerDay':100}, indent=2))
if __name__=='__main__': main()
