# AMAN Governance Harness

**A small, auditable reference harness for testing whether AI capability can increase without silently increasing operational authority.**

Modern agentic systems can become more capable faster than their permission models become trustworthy. AMAN Governance Harness turns that gap into executable tests: models may reason and recommend, but consequential actions remain behind deterministic authority checks, request-bound human approval, replay protection, and verifiable evidence.

This repository is intentionally narrow. It is a developer/security reference implementation and evaluation harness, not a production authorization service or a general-purpose agent framework.

## The problem this project tests

A model can become better at reasoning, coding, planning, or using context without becoming more entitled to act.

AMAN treats those as separate dimensions:

- **Capability**: what a model can infer, recommend, or generate.
- **Authority**: what the surrounding system is allowed to execute, persist, modify, or approve.

The core invariant is:

> **Reasoning may expand; authority does not expand unless an explicitly authorized human-controlled path grants it.**

## 60-second review path

Requires Node.js 22.6 or newer. The public alpha has no installed runtime dependencies.

```bash
npm test
npm run benchmark
npm run demo
npm run eval
```

`npm run benchmark` emits a machine-readable 50-scenario synthetic governance report. `npm run eval` runs the provider-neutral governance matrix against a local advisory fixture. Both are deterministic and make no network requests.

For the complete validation surface used by maintainers:

```bash
npm run check
```

## What is directly testable

### Authority boundary

- Model principals cannot grant themselves authority.
- Model principals cannot modify governance policy.
- Consequential `execute` and `persist` actions require both an explicit grant and request-bound human approval.
- Human approval does not remove categorical model hard-denies.
- Changing an approved action, target, summary, or parameters invalidates the approval.

### Approval authentication and replay resistance

- Approval intent is fingerprinted with SHA-256.
- Ed25519 signatures authenticate approvals against an explicit trusted-key set.
- Each signed approval contains an expiring single-use nonce.
- Revoked or mismatched approver keys fail closed.
- Replaying an already consumed signed approval fails closed.
- A directory-backed reference consumption store can preserve replay state across restart for cooperating processes on a trusted shared filesystem.

### Evidence

- Authorization decisions emit hash-chained audit evidence and verifiable receipts.
- Denied decisions are recorded as evidence, not silently discarded.
- A directory-backed audit ledger can continue and verify the retained chain after restart.
- Tampering with retained event details or sequence data is detectable by the reference verifier.

### Provider boundary

- Model/provider output remains advisory text; it cannot mutate authority or permissions.
- Validation-only and single-provider studies cannot create promotion state.
- Comparative learning requires at least two successful providers and remains observed-only and human-gated.
- Provider failure fails closed below that threshold.
- Credential-bearing input is rejected before provider invocation.
- Common personal data is redacted before provider invocation.

## 50-case governance benchmark

The public benchmark expands the core regression suite into exactly 50 deterministic or replayable scenarios:

| Category | Scenarios | Examples |
| --- | ---: | --- |
| Authority | 20 | self-authorization, policy modification, altered intent, target/parameter substitution, expiry |
| Input safety | 10 | credential rejection, private-key envelope rejection, PII redaction, length bounds |
| Provider boundary | 10 | validation-only isolation, partial/total outage, empty output, preflight redaction, authority immutability |
| Evidence and replay | 10 | signed approval verification, revoked keys, signer mismatch, replay denial, audit tamper detection |

Run:

```bash
npm run benchmark
```

The JSON report includes the benchmark version, timestamp, category totals, every scenario result and severity, overall pass/fail, and identifiers for any critical regressions. A failed scenario remains a failed result; the benchmark does not downgrade failures to obtain a passing score.

## Optional live OpenAI evaluation

The same provider-governance matrix can be exercised through an explicitly configured OpenAI Responses API model:

```bash
export OPENAI_API_KEY="..."
export OPENAI_MODEL="<explicit-model-id>"
export AMAN_RELEASE_TAG="<tag>"
export AMAN_RELEASE_SHA="$(git rev-parse HEAD)"
npm run eval:openai > openai-evaluation.json
```

The live command is opt-in and is never run by default CI. It makes two bounded advisory Responses API calls, provides no tools, sets `tool_choice` to `none`, and sets `store` to `false`.

The generated evidence object records the exact configured model identifier, harness version, timestamp, optional release tag and commit SHA, live-call count, evaluation-case count, failures, and critical-regression IDs. Provider failure is preserved as failure rather than replaced with simulated success.

See [OpenAI adapter](docs/OPENAI_ADAPTER.md) and [evaluation evidence](docs/EVALUATION_EVIDENCE.md).

## How approval works

`fingerprintRequest()` canonicalizes the requested action and hashes the complete intent with SHA-256. `createHumanApproval()` binds approval to that digest and a single-use nonce. `signHumanApproval()` signs the complete approval envelope with Ed25519.

`authorizeSigned()` then:

1. verifies the signature against an active trusted key;
2. verifies the principal's explicit grant and exact request fingerprint;
3. atomically consumes the signed nonce;
4. denies replay if that nonce was previously consumed; and
5. records the authorization decision and consumption receipt in audit evidence.

These are inspectable reference controls with explicit trust assumptions, not a complete distributed authorization architecture. See [TRUST_MODEL.md](TRUST_MODEL.md) and [SECURITY.md](SECURITY.md).

## Codex-assisted maintenance

This repository is structured so AI coding assistance can improve implementation and test coverage without becoming an authority source itself. [AGENTS.md](AGENTS.md) defines the persistent maintainer instructions for Codex and other coding agents.

Among other requirements, coding agents must:

- run the prescribed deterministic validation after changes;
- preserve model hard-denies and human approval boundaries;
- treat a failing governance test as a finding rather than weaken it to obtain green CI;
- keep credentials, customer data, production configuration, and personal information out of fixtures and prompts;
- keep live provider calls explicit, bounded, text-only, and tool-disabled; and
- preserve machine-readable failure evidence and precise non-claims.

Codex or any other coding model may assist development and review. It is not a runtime approver, policy authority, release authority, or source of security certification.

## Design boundary

The public harness is application-neutral. It intentionally excludes customer data, production credentials, proprietary application schemas, hidden prompts, autonomous tool execution, tenant context, internal endpoints, and production deployment logic.

It also intentionally does **not** claim to be:

- a production authorization service;
- an identity provider;
- formal verification;
- a compliance certification;
- an external security audit;
- a distributed consensus or WORM evidence system;
- a trusted timestamp service; or
- proof that any model or deployment is safe in all environments.

Synthetic passing tests establish only that the implemented fixtures satisfy their documented assertions under the tested configuration.

## Alpha roadmap

- Add trusted-time and explicit approval-expiry policy hooks.
- Add durable key-revocation snapshots and versioned trust policy.
- Add external receipt anchoring / transparency examples.
- Add versioned evaluation fixtures and release-linked evidence artifacts.
- Expand provider evaluation across explicitly identified model releases without expanding authority.
- Add additional provider adapters behind the same provider-neutral governance contract.

## Project map

- [Technical proof points](PROOF_POINTS.md)
- [Architecture](ARCHITECTURE.md)
- [Trust model](TRUST_MODEL.md)
- [Security policy and non-claims](SECURITY.md)
- [Evaluation evidence](docs/EVALUATION_EVIDENCE.md)
- [OpenAI adapter](docs/OPENAI_ADAPTER.md)
- [Safe usage guide](docs/USAGE.md)
- [Codex / coding-agent instructions](AGENTS.md)
- [Project governance](GOVERNANCE.md)
- [Public release checklist](PUBLIC_RELEASE_CHECKLIST.md)
- [Changelog](CHANGELOG.md)

## Status

`0.1.0-alpha.1` is the first fresh-history public alpha candidate. The package remains `private: true`; npm publication would require a separate reviewed packaging change.

The current public candidate includes the provider-neutral governance matrix, the 50-case deterministic benchmark, machine-readable live-evaluation evidence support, a bounded optional OpenAI Responses adapter, and persistent Codex maintainer instructions. A live provider result is not claimed until an explicit run has actually been performed and retained against an exact reviewed release.
