#!/usr/bin/env python3
"""Draft-only content agent. It never auto-publishes."""
from pathlib import Path
from datetime import date
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'; OUT.mkdir(exist_ok=True)

def main():
    draft = f'''# Draft: Why agent payments need receipts\n\nDate: {date.today().isoformat()}\n\nAI agents can now discover tools, make payment requests, and execute multi-step work. The missing operational layer is evidence that links identity, policy, action, result, and payment.\n\nMachine Commerce Proof is an open prototype for that evidence layer. It creates signed, hash-linked receipts that a customer or auditor can verify independently.\n\nThis is a draft. Verify every external claim before publication.\n'''
    (OUT / f'content-draft-{date.today().isoformat()}.md').write_text(draft)
    print(draft)
if __name__=='__main__': main()
