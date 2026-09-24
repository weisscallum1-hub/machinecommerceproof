#!/usr/bin/env python3
"""Zero-cost prospect generator using public GitHub search endpoints.
It finds repositories/services likely to benefit from agent-commerce readiness work.
No emails are sent and no outreach is performed.
"""
from __future__ import annotations
import json, re, sys, urllib.parse, urllib.request
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'; OUT.mkdir(exist_ok=True)

QUERIES = [
    '"x402" language:JavaScript',
    '"MCP server" language:TypeScript',
    '"Model Context Protocol" language:Python',
    '"agent marketplace" language:TypeScript',
]


def fetch_json(url: str):
    req = urllib.request.Request(url, headers={'User-Agent': 'MCPx-LeadFinder/0.2', 'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def score(item: dict) -> int:
    text = f"{item.get('name','')} {item.get('description','')}".lower()
    points = 0
    for term, p in [('x402', 25), ('mcp', 15), ('agent', 10), ('api', 8), ('payment', 12), ('marketplace', 8), ('server', 6)]:
        if term in text: points += p
    points += min(int(item.get('stargazers_count', 0)) // 50, 15)
    return min(points, 100)


def main():
    rows = []
    for q in QUERIES:
        params = urllib.parse.urlencode({'q': q, 'per_page': 10, 'sort': 'updated', 'order': 'desc'})
        url = f'https://api.github.com/search/repositories?{params}'
        try:
            data = fetch_json(url)
        except Exception as exc:
            rows.append({'query': q, 'error': str(exc)})
            continue
        for item in data.get('items', []):
            rows.append({
                'name': item.get('full_name'),
                'url': item.get('html_url'),
                'description': item.get('description'),
                'stars': item.get('stargazers_count', 0),
                'updatedAt': item.get('updated_at'),
                'score': score(item),
            })
    dedup = {r.get('url'): r for r in rows if r.get('url')}
    out = sorted(dedup.values(), key=lambda x: (x['score'], x['stars']), reverse=True)
    stamp = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    result = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'prospects': out[:30], 'note': 'Research leads only; no automated outreach.'}
    (OUT / f'leads-{stamp}.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
