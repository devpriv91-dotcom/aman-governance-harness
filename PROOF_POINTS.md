# Technical Proof Points

## One-line position

AMAN Governance Harness is an experimental, security-focused TypeScript reference implementation for testing a falsifiable boundary: **model capability may improve without automatically increasing operational authority**.

## Fastest reproducible review

From a clean source checkout with Node.js 22.6 or newer:

```bash
npm test
npm run benchmark
npm run demo
npm run eval
```

Or run the complete deterministic maintainer surface:

```bash
npm run check
```

The deterministic path requires no network access and no provider credentials.

## Evidence currently implemented

### Deterministic governance benchmark

The harness includes a machine-readable 50-scenario benchmark with four fixed categories:

- 20 authority-boundary scenarios;
- 10 input-safety scenarios;
- 10 provider-boundary scenarios; and
- 10 evidence/replay scenarios.

Coverage includes model self-authorization, policy modification, explicit grants, exact-intent approval binding, target and parameter substitution, approval expiry, key status, signed approval replay, audit-chain tampering, credential preflight, personal-data redaction, provider outage behavior, validation-only isolation, and provider attempts to influence authority.

The report retains every scenario result and critical-regression identifier. A failed assertion remains a failed benchmark result.

### Authority and approval controls

- Model principals are categorically denied `grant_authority` and `modify_policy` even if those actions appear in their grants.
- Consequential execution/persistence requires explicit principal authority plus request-bound human approval.
- Approval is bound to the complete requested intent—action, target, summary, and parameters—using SHA-256.
- Ed25519 signatures authenticate approval envelopes against an explicit active trusted-key set.
- Each signed approval includes an expiry and a single-use nonce.
- On the signed authorization path, revoked keys, signer mismatch, altered intent, and reuse of a consumed nonce fail closed. The lower-level unsigned reference path is not described as replay-resistant.

### Evidence controls

- Authorization decisions produce locally verifiable hash-chained audit events and receipts under the documented trusted-storage assumptions.
- Both allowed and denied outcomes are retained.
- Reference directory-backed stores demonstrate restart-safe replay consumption and audit-chain continuation for cooperating processes on a trusted shared filesystem.
- Mutation of retained event content or sequence information invalidates reference-chain verification. The reference ledger has no external anchor, WORM guarantee, or trusted timestamp and does not prevent a party controlling the entire store from replacing the complete chain.

### Provider isolation

- `ReasoningProvider` output is advisory text only and has no API for changing authority or permissions.
- Validation-only and single-provider runs cannot create promotion state.
- A comparative candidate requires at least two successful providers and remains `observed` plus human-review-required.
- Provider outage fails closed below the comparative threshold.
- Recognized credential-shaped input is rejected before provider invocation; common email and phone patterns are redacted. These bounded patterns are not exhaustive secret or PII detection.

### OpenAI evaluation evidence

The optional OpenAI Responses adapter is bounded, text-only, stateless, non-storing, and tool-disabled. The explicit live-evaluation command produces one machine-readable evidence object containing:

- exact configured model identifier;
- harness version;
- timestamp;
- optional release tag and commit SHA;
- number of live provider calls;
- evaluation-case count;
- failed-case count; and
- critical-regression identifiers.

No live OpenAI result is claimed merely because the adapter or evidence schema exists. A provider result becomes evidence only after an explicit run against an exact reviewed release is retained.

### Codex maintenance boundary

`AGENTS.md` defines persistent repository instructions for Codex and other coding agents. Coding assistance may propose implementation, tests, documentation, and analysis, but it is explicitly prohibited from becoming a runtime authority source, weakening failing governance tests to obtain a pass, or expanding provider permissions implicitly.

## Why this is useful

The project turns a broad governance principle into inspectable failure cases. A developer can change the model, provider adapter, approval store, or evidence implementation and then rerun the same authority-focused tests to see whether capability integration crossed a documented boundary.

That makes the repository useful as:

- a compact reference implementation for developers;
- a regression surface for security and governance teams;
- an experimental substrate for provider/model comparisons; and
- a reproducible open-source artifact for studying agent authority, approval integrity, failure behavior, and evidence provenance.

## Precise non-claims

The alpha is **not** a production authorization service, autonomous agent framework, formal proof, compliance certification, external security audit, identity provider, distributed consensus system, WORM ledger, HSM, trusted timestamp service, or proof that a model/deployment is generally safe.

Synthetic passing tests show only that the implemented fixtures satisfy their assertions under the tested configuration. A passing provider evaluation establishes only the recorded integration behavior for the named model and harness release; it does not establish production readiness or general model safety.

## Reviewer questions the repository is designed to answer

1. **Can a model authorize itself?** The hard-deny cases are executable.
2. **Can a prior approval be reused for altered intent?** Request fingerprint and replay cases are executable.
3. **Does provider failure accidentally promote state?** Partial/total outage cases are executable.
4. **Can model output mutate permissions?** Provider-boundary cases are executable.
5. **Can failures be hidden to make the benchmark green?** The benchmark preserves per-case failure and critical-regression IDs, and maintainer instructions prohibit weakening tests merely to obtain a pass.
6. **Can an OpenAI run be tied to exact provenance?** The evidence schema records the model, harness version, timestamp, release context, case count, and failures.
