# Agent Fleet

## 1. Scout Agent

Purpose: detect new standards, SDKs, directories, agent frameworks and security problems.

Inputs: curated public feeds/URLs.

Output: `artifacts/scout-YYYY-MM-DD.md`.

Mode: deterministic first; optional LLM summarization.

## 2. Readiness Analyst

Purpose: inspect a public site/API and score:

- machine readability
- discoverability
- payment readiness
- identity/trust hooks
- auditability
- documentation quality

It outputs actionable fixes, never claims guaranteed sales or compliance.

## 3. Receipt Agent

Purpose: wrap each paid service invocation in a signed receipt containing:

- run id
- agent id
- action
- input hash
- output hash
- timestamp
- policy decision
- payment correlation id
- previous receipt hash

## 4. Revenue Agent

Purpose: monitor usage and calculate gross turnover, ARPU, active customers and x402 request volume.

It does not move treasury funds or trade assets.

## 5. Content Agent

Purpose: turn verified telemetry into factual technical posts, changelogs and case-study drafts.

A human approves public claims before publication.

## 6. Health Agent

Purpose: monitor public endpoints and detect downtime, elevated latency, error rates and stale metadata.

## 7. Strategy Agent

Purpose: once per week, compare new ecosystem developments with the existing product and produce:

- continue
- improve
- add integration
- deprecate

It provides recommendations but never authorizes financial or legal actions.
