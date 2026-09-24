#!/usr/bin/env python3
"""Public URL readiness scanner. No credentials or paid APIs required.
Usage: python agents/readiness.py https://example.com
"""
from __future__ import annotations
import json, sys, urllib.request, urllib.error
from urllib.parse import urljoin


def fetch(url: str, method='GET'):
    req = urllib.request.Request(url, method=method, headers={'User-Agent':'MCPx-Readiness/0.2', 'Accept':'application/json,text/plain,*/*'})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status, r.headers, r.read(12000)
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read(4000)
    except Exception as e:
        return None, {}, str(e).encode()


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: readiness.py https://example.com')
    base = sys.argv[1].rstrip('/') + '/'
    checks = []

    def add(name, category, points, status, detail=''):
        checks.append({'name':name,'category':category,'points':points,'pass':bool(status),'detail':detail})

    for path, category, points in [
        ('robots.txt','discoverability',8),
        ('sitemap.xml','discoverability',8),
        ('llms.txt','machine_readability',10),
        ('openapi.json','api_documentation',10),
        ('.well-known/agent-proof.json','agent_identity',15),
        ('skill.md','agent_capability',10),
    ]:
        st, headers, body = fetch(urljoin(base, path))
        add(path, category, points, st is not None and 200 <= st < 400, f'HTTP {st}' if st else 'unreachable')

    # A real x402 signal is an HTTP 402 response from a documented/probed API endpoint,
    # not a made-up well-known path. Start with the conventional /v1/proof/deep path,
    # but only score it when it actually returns 402.
    st, headers, body = fetch(urljoin(base, 'v1/proof/deep'), method='GET')
    x402 = st == 402 or 'payment-required' in {k.lower() for k in headers.keys()} or 'PAYMENT-REQUIRED' in headers
    add('v1/proof/deep -> HTTP 402','payment_readiness',19, x402, f'HTTP {st}; PAYMENT-REQUIRED={x402}')

    score = sum(x['points'] for x in checks if x['pass'])
    maximum = sum(x['points'] for x in checks)
    report = {'score':score,'maximum':maximum,'url':base.rstrip('/'),'checks':checks}
    print(json.dumps(report, indent=2))

if __name__ == '__main__': main()
