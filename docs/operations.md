# Autonomous Operations

## Human approval gates

The system can run autonomously for public monitoring, report generation and draft content. Keep human approval for:

- public token launches
- listing/market-making decisions
- contract upgrades
- legal/compliance claims
- custody/treasury transfers
- publishing customer-specific claims

## Failure policy

When evidence is incomplete, the agent should return `UNKNOWN`, not invent confidence.

When payment is missing, the service should fail closed for paid operations.

When a monitored dependency is down, the agent should record the incident and avoid fabricating an “all clear.”

## Exit-to-next-project criteria

The business is sufficiently automated to hand off when:

- 80%+ of customer onboarding is self-serve
- reports are generated without manual editing except factual review
- recurring revenue covers hosting and model costs
- inbound/API usage is the majority of new pipeline
- support issues are documented and repeatable

At that point, either keep it as a low-touch software property or move into the next adjacent infrastructure problem.
