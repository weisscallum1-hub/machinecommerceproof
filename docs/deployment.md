# Deployment path

## Zero-cost public surface

- Static site: GitHub Pages.
- API: Cloudflare Workers + D1 Free during prototype stage.
- Source/automation: GitHub Actions.
- LLM: optional local Ollama; deterministic agents work without an LLM.

## Why this combination

The static site needs no server. The API can operate in a free serverless environment, while D1 provides persistent SQL storage. Keep the local Node server as the canonical development/self-test target.

## Necessary human actions

The only unavoidable actions are account creation/authentication, selecting a deployment account, configuring a secret key, choosing a receiving address, and approving any real-money or legal operation.

## Production security defaults

For any publicly reachable deployment, set these explicitly:

```bash
NODE_ENV=production
CORS_ORIGIN=https://your-console.example
PROOF_WRITE_TOKEN=<strong-random-secret>
ADMIN_TOKEN=<separate-strong-random-secret>
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
```

`PROOF_WRITE_TOKEN` protects receipt creation because a public proof generator otherwise allows any caller to obtain a server signature for arbitrary supplied claims. `ADMIN_TOKEN` protects stored receipt/task retrieval and chain inspection. Verification of a supplied receipt remains public.

Keep `TRUST_PROXY=false` unless the service is actually behind a proxy whose forwarded-client headers you control.

Generate fresh local secret values with:

```bash
npm run generate-secrets
```

Copy the results into your secret manager or local untracked environment. Do not commit them. `.env.example` is only a configuration template.

For Docker Compose, create an untracked `.env` next to `docker-compose.yml` using `.env.example` as the template. Compose will pass the security settings into the container. Never commit the real `.env`.
