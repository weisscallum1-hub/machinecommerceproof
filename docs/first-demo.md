# First demo

This is the fastest way to show Machine Commerce Proof without deploying anything.

## 1. Run the self-test

```bash
npm test
```

## 2. Verify the included receipt

```bash
./scripts/verify-example.sh
```

Expected result:

```json
{
  "verified": true,
  "hashValid": true,
  "signatureValid": true,
  "signerFingerprintValid": true
}
```

## 3. Start the local API

```bash
npm start
```

Then open:

- `http://localhost:4020/health`
- `http://localhost:4020/.well-known/agent-proof.json`
- `http://localhost:4020/v1/stats`

## 4. Create and verify a receipt

```bash
curl -s http://localhost:4020/v1/proof \
  -H 'content-type: application/json' \
  -d '{"agentId":"demo-agent","action":"quote_service","policy":"allowed","input":{"sku":"demo"},"output":{"price":39}}' \
  > /tmp/mcp-proof-response.json
```

Copy the `receipt` object into a JSON file and run:

```bash
npm run verify -- /path/to/receipt.json
```

## 5. Public deployment

Deploy the API only after reviewing `docs/deployment.md` and `docs/legal-gates.md`. Keep private signing material in the platform secret store; never commit it.
