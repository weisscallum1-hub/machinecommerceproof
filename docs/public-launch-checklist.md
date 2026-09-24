# Public Launch Checklist

This checklist is intentionally limited to the open-source, non-custodial prototype.

## Completed

- Public repository created: `weisscallum1-hub/machinecommerceproof`.
- Source published on `main`; CI and official SDK interoperability workflows pass.

## Remaining optional launch steps

### 1. Publish the static demo

Enable GitHub Pages with a workflow that publishes the `web/` directory, or choose another static host. No Pages workflow or site has been configured yet. Keep Pages informational and non-transactional.

### 2. Deploy the API separately

The Node Docker image is the current API recommendation because it implements the tested A2A profile and stores its signing key and runtime history on a persistent volume. Choose a Docker-capable host and set the production secrets, HTTPS ingress, backup, and health-check settings described in `docs/deployment.md`.

### 3. Keep the payment route disabled initially

The local proof API works without a payment rail. Treat the x402 route as an optional adapter and validate it independently before enabling any paid endpoint.

### 4. Keep autonomy bounded

Research, readiness checks, proof generation, health checks and draft content can be automated. Keep account creation, credentials, legal statements, financial actions and public commercial commitments behind explicit human approval.
