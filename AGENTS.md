# AMAN Governance Harness — Agent Instructions

These instructions apply to the entire public harness tree.

## Purpose

Maintain this repository as a small, auditable reference harness for separating AI/model capability from execution authority. AI coding agents may assist with implementation, tests, documentation, and analysis. They are never an authority source for runtime actions, policy changes, approvals, releases, or security claims.

## Required validation

After changing any file in this tree, run:

```bash
npm run check
```

If the change touches the OpenAI adapter or live-evaluation evidence path, also run the deterministic tests for those modules. Run `npm run eval:openai` only when an authorized maintainer intentionally supplies an API key and exact model configuration.

Never weaken, delete, skip, or reclassify a failing governance test merely to make validation pass. Treat a failure as a finding until the underlying behavior is understood and corrected.

## Authority boundaries

Preserve these invariants:

- A model cannot grant itself authority or modify governance policy.
- Consequential execution and persistence require explicit authority and request-bound human approval.
- Human approval does not override categorical model hard-denies.
- Approval reuse, altered intent, parameter substitution, target substitution, expiry, revoked keys, and replay must fail closed.
- Provider/model output is advisory text only and cannot mutate authority or permissions.
- Validation-only and single-provider evaluation cannot create promotion state.
- Provider failure must not be simulated as provider success.

Any proposed change to these invariants requires explicit maintainer review and must be called out in the pull-request description.

## Evidence rules

- Keep synthetic tests labeled synthetic.
- Do not describe repository tests as production validation, certification, formal verification, penetration testing, or an external audit.
- Do not invent users, deployments, adoption, vulnerabilities, remediations, benchmark superiority, or funding outcomes.
- Preserve machine-readable failure evidence; do not normalize failures into passes or warnings.
- Tie live evaluation evidence to the exact model identifier, harness version, release tag/commit when available, timestamp, case count, and critical regressions.

## Security and privacy

- Never commit or paste credentials, private keys, API tokens, customer data, tenant identifiers, production endpoints, or personal information into tests, examples, prompts, fixtures, logs, or documentation.
- Keep deterministic tests offline.
- Keep live provider calls opt-in and text-only; do not add tools, browsing, code execution, persistence, or autonomous external actions to provider adapters.
- Do not weaken the reviewed export allowlist or secret scanner to accommodate a test fixture. Make synthetic fixtures scanner-safe instead.

## Scope boundary

This public harness must remain independent of private products and deployments. Do not add private product names, internal architecture, customer context, production configuration, or proprietary integration details.

## Pull requests

For security- or governance-relevant changes, state:

1. the invariant being tested or changed;
2. the failure mode addressed;
3. the deterministic evidence added;
4. whether authority or permissions can change; and
5. the exact validation command/result.

Keep changes reviewable and prefer small, independently testable increments.
