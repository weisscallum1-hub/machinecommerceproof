# Public Launch Checklist

This checklist is intentionally limited to the open-source, non-custodial prototype.

## 1. Create a brand-new repository

Create `machine-commerce-proof` under the intended GitHub account. Do not initialize it with a README, license, `.gitignore`, or template because this release already contains those files.

## 2. Publish the local repository

From the project root:

```bash
./scripts/publish-to-new-github.sh weisscallum1-hub machine-commerce-proof
```

The helper refuses to replace an existing local `origin`. Confirm the destination is the new repository before pushing.

## 3. Confirm CI

Open the repository's Actions tab and confirm the `ci` workflow passes on `main`.

## 4. Enable the static demo

Use GitHub Pages with the `web/` directory as the published static surface, or place that directory behind any equivalent static host.

## 5. Deploy the API separately

Use the Cloudflare Worker target under `cloudflare-worker/` only after creating a new D1 database and configuring the signing key as a deployment secret.

## 6. Keep the payment route disabled initially

The local proof API works without a payment rail. Treat the x402 route as an optional adapter and validate it independently before enabling any paid endpoint.

## 7. Keep autonomy bounded

Research, readiness checks, proof generation, health checks and draft content can be automated. Keep account creation, credentials, legal statements, financial actions and public commercial commitments behind explicit human approval.
