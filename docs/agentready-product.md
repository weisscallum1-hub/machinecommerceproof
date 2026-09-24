# AgentReady commercial MVP

AgentReady is the customer-facing readiness product built on the Machine Commerce Proof foundation. The existing receipt service, API, SDK, agent protocol profiles, and machine-readable proof concepts remain available as the deeper trust and agent-infrastructure layer.

## Current MVP

- Public landing page served by the Node reference server.
- Free, consent-gated public website snapshot at `POST /api/snapshot`.
- Passive checks for page reachability, HTTPS, title/description, JSON-LD, canonical and viewport metadata, public robots/llms/agent-proof endpoints, privacy/terms links, language declaration, and four response security headers.
- Read-only report with timestamp, score, category-independent evidence, scope statement, and print/save action.
- Existing signed proof APIs, SDK, MCP/A2A adapters, and public agent capability profiles remain the foundation for future trust and agent connectivity.
- Pilot pricing and a mailto inquiry path are clearly labelled as proposals. There is no payment collection, outbound sending, account system, database of customers, or recurring scheduler in this release.

## Snapshot safety

The endpoint requires an explicit authorization checkbox, standard HTTP(S) URL, standard port, public DNS resolution, and rejects local, reserved, and IP-literal destinations. DNS answers are pinned for each request to reduce rebinding risk. It does not follow redirects, send credentials, submit forms, scan ports, probe vulnerabilities, or make changes. Requests time out, cap response size, and are rate-limited by the existing server limiter. Run behind a reverse proxy with HTTPS and production rate-limit configuration before public launch.

Snapshots are indicative signals only. A missing header or file is not proof of vulnerability. The score does not assess AI answers or rankings, establish legal/security compliance, or guarantee outcomes. AI visibility assessment, governance questionnaires, commerce integrations, and human-reviewed paid reports are follow-on product work.

## Product and pricing hypothesis

1. **Snapshot — free:** low-friction public baseline.
2. **Readiness Review — $149 one-time pilot:** human-reviewed report and 30-day action plan. Deliver manually until repeatability and demand are established.
3. **Monitor — proposed $49/month:** scheduled public baseline, change history, alerts and trust profile. Not sold until storage, account security, and monitoring operations are implemented.
4. **Fix / Connect / Transact — scoped services and later platform modules:** explicit customer approval for changes, credentials, integrations, payments and transactions.

The price is a hypothesis to validate with the first customers, not a revenue forecast.

## First-customer operating workflow

1. Invite a prospect to run the free snapshot. Keep prospect research and outreach manual and permission-aware.
2. Review the evidence and correct false positives before sharing any recommendation.
3. Offer the paid Readiness Review only after agreeing scope, delivery time, currency, tax treatment, and payment method directly with the customer.
4. Produce a human-reviewed report; never represent the snapshot as a security audit or guarantee.
5. Ask permission before storing monitoring data, connecting an account, changing a site, sending follow-ups, or initiating any financial or agent action.

## Launch configuration and next gates

- Set `NODE_ENV=production`, a narrow `CORS_ORIGIN`, `RATE_LIMIT_ENABLED=true`, and production write/admin tokens as appropriate. See `.env.example` and deployment docs.
- Host the Node server and `web/` together, or configure a reverse proxy to route `/api/snapshot` to Node and static files to the `web/` directory.
- Add persistent consent, customer, report, monitoring schedule, and audit-event records before selling a recurring plan.
- Add authenticated customer access, deletion/export controls, retention policy, privacy notice, and a real contact address before collecting personal information at scale.
- Implement the full score taxonomy (Discoverability 20, Information 20, Trust & Security 20, Agent Accessibility 15, Automation 15, Commerce 10), source citations, confidence levels, and report export before calling the offering a full audit.
- Add provider adapters for answer-engine observations, mail delivery, billing, and scheduled jobs; keep them disabled without credentials and retain human approval gates.
- Choose an operator, jurisdiction, legal entity, supported currency, tax/invoicing approach, support mailbox, and hosting credentials before public commercial launch.

## Local run

```bash
npm test
npm start
```

Open `http://localhost:4020`. With no external service keys, the existing proof platform and landing page work locally; snapshots require a reachable public test domain.
