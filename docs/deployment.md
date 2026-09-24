# Deployment options

## Recommendation for this release

Use a static host for the demo pages and a Docker-capable container host for the API. The Node server in the Docker image is the canonical runtime for this release and is the only deployment target here that implements the advertised A2A 1.0 task endpoints. Keep the API private until its production secrets, TLS endpoint, and persistent storage are configured.

## Option 1: Static demo with GitHub Pages

The files in `web/` are static HTML, CSS, and JavaScript, so they can be published separately from the API. GitHub Pages can publish a directory from a repository or a workflow artifact. This repo does not yet include a Pages deployment workflow, and Pages does not run the API. Use it for the informational demo and browser-side receipt verifier only; the audit page needs a separately deployed API URL.

This public repo is eligible for Pages on GitHub Free. Keep the site informational: GitHub says Pages is not intended to host an online business, e-commerce site, or a site primarily directed at commercial transactions or SaaS. See [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) and [publishing source options](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Option 2: Docker API host (recommended API path)

The root `Dockerfile` and `docker-compose.yml` run the tested Node server and preserve signing keys, receipt logs, and task logs in the `mcp-proof-data` volume. Choose a container host that provides a persistent volume, HTTPS ingress, health checks, and managed secrets. The repo does not select a vendor or configure a production domain.

Before making the API public:

- Set separate, high-entropy `PROOF_WRITE_TOKEN` and `ADMIN_TOKEN` values. Compose currently allows them to be blank, which disables those authentication checks.
- Set `CORS_ORIGIN` to the exact trusted console origin, or leave it empty if browser access is not required.
- Keep `TRUST_PROXY=false` unless the service is behind a proxy whose forwarding headers are controlled.
- Keep the named data volume attached across restarts and configure encrypted backups. The volume contains the private signing key and operational history.
- Put TLS at the host ingress or a controlled reverse proxy; the Compose file exposes plain HTTP on port 4020.

Generate secrets with `npm run generate-secrets`, then place them in the host's secret manager. Do not commit a real `.env` file.

## Option 3: Cloudflare Workers + D1 (not ready as the public A2A API)

The Worker is a separate prototype implementation, not a serverless packaging of the Node service. Its own audit descriptor marks A2A as `mapping-only`; it does not publish an A2A Agent Card or implement A2A tasks. It also currently allows wildcard CORS and has no bearer authorization on proof creation or stored receipt reads. Do not use it as a public signing API until those gaps are addressed and the Worker passes its own security and interoperability checks.

Workers + D1 can still be evaluated as a later serverless target. Cloudflare's current Free-tier documentation lists 100,000 Worker requests per day and D1 allowances of 5 million rows read per day, 100,000 rows written per day, and 5 GB total storage. Exceeding D1 Free limits causes queries to fail until the allowance resets or the plan changes; verify the [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 pricing and limits](https://developers.cloudflare.com/d1/platform/pricing/) before deployment.

## Secrets and production settings

For any public Node API deployment, set:

```text
NODE_ENV=production
CORS_ORIGIN=https://your-console.example
PROOF_WRITE_TOKEN=<strong-random-secret>
ADMIN_TOKEN=<separate-strong-random-secret>
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
TRUST_PROXY=false
```

`PROOF_WRITE_TOKEN` protects receipt creation because a public proof generator otherwise lets callers request server signatures for arbitrary supplied claims. `ADMIN_TOKEN` protects stored receipt/task retrieval and chain inspection. Verification of a supplied receipt remains public.

For local Compose, create an untracked `.env` beside `docker-compose.yml` from `.env.example`. Compose forwards the settings into the service. Never commit the real `.env`.

## Human-controlled deployment steps

Publishing the repository does not create a website or API deployment. An account owner still needs to enable/configure Pages or choose and authenticate to an API host, create the deployment secrets, and approve a public endpoint. No real payment rail should be enabled as part of the prototype deployment.
