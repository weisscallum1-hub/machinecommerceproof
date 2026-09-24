#!/usr/bin/env python3
from __future__ import annotations
import json, sys, time, urllib.request

def check(url: str):
    started = time.perf_counter()
    try:
        req = urllib.request.Request(url, headers={'User-Agent':'MCPx-Health/0.1'})
        with urllib.request.urlopen(req, timeout=10) as r:
            r.read(256)
            return {'url':url,'status':r.status,'latencyMs':round((time.perf_counter()-started)*1000,1)}
    except Exception as e:
        return {'url':url,'error':str(e),'latencyMs':round((time.perf_counter()-started)*1000,1)}

def main():
    urls = sys.argv[1:] or ['http://localhost:4020/health']
    print(json.dumps([check(u) for u in urls], indent=2))
if __name__=='__main__': main()
