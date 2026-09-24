#!/usr/bin/env python3
"""Deterministic public-web scout. No API key required.
Run locally or from GitHub Actions.
"""
from __future__ import annotations
import datetime as dt
import json
import os
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / 'agents' / 'config.json').read_text())
OUT = ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={'User-Agent': 'MCPx-Scout/0.1'})
    with urllib.request.urlopen(req, timeout=CFG['monitor']['timeoutSeconds']) as r:
        return r.read(20000).decode('utf-8', errors='replace')


def main() -> None:
    today = dt.date.today().isoformat()
    lines = [f'# Scout report — {today}', '', 'Public endpoint checks:']
    for url in CFG['urls'] + CFG['public_directories']:
        try:
            body = fetch(url)
            lines.append(f'- OK {url} ({len(body)} bytes sampled)')
        except Exception as exc:
            lines.append(f'- ERROR {url}: {exc}')
    lines += ['', 'Next step: run the Analyst agent with any new ecosystem evidence.']
    (OUT / f'scout-{today}.md').write_text('\n'.join(lines))
    print('\n'.join(lines))

if __name__ == '__main__':
    main()
