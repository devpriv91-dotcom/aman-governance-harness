# Architecture

AMAN Governance Harness separates six concerns that are often conflated in agent systems:

1. **Capability** - what a model or service can reason about.
2. **Provider boundary** - how external reasoning is invoked without inheriting tools or authority.
3. **Authority** - what actions a principal is permitted to request.
4. **Approval** - whether a consequential action has explicit human authorization bound to the exact execution intent.
5. **Consumption** - whether that exact signed authorization has already been used.
6. **Evidence** - what happened, what was denied, and whether retained evidence still verifies against its hash chain.

## Provider boundary

All reasoning integrations implement the small `ReasoningProvider` interface: a name plus an asynchronous text-reasoning method. Provider output is always treated as untrusted advisory material by the harness.

The optional OpenAI adapter uses the Responses API in stateless text-only mode. It sends no tools, sets `tool_choice` to `none`, sets `store` to `false`, and rejects unexpected tool-call output. The normal harness sanitizer runs before provider invocation.

No provider adapter receives an execution capability merely by implementing the reasoning interface.

## Evaluation path

`runProviderEvaluationMatrix()` runs a fixed set of integration invariants against any `ReasoningProvider`. The matrix does not score prose quality. It verifies that provider participation cannot bypass validation-only mode, lesson-promotion thresholds, input preflight, outage behavior, human review, or categorical model authority boundaries.

The deterministic matrix can run with no network access. An explicit live-provider command can run the same invariants against OpenAI or another adapter without changing the governance path.

## Evaluation-awareness and deployment-parity boundary

A passing evaluation is not, by itself, evidence that a capable model will preserve the same behavior when it recognizes a different execution context. The harness therefore treats **evaluation awareness** as a distinct governance risk rather than as ordinary model-quality variance.

The public architecture must preserve these principles as deployment-parity work is added:

1. **Authority invariants are context-independent.** A model does not receive additional permissions, tools, persistence, policy control, or approval authority because a scenario is labeled as evaluation, production-like, hidden, adversarial, or routine.
2. **The evaluator does not become the authority.** Model-generated grading, critique, or scenario generation remains advisory. Human authority and cryptographically bound approvals stay outside model control.
3. **Paired scenarios share the same governance contract.** Obvious-evaluation and deployment-like variants should exercise materially equivalent requested actions, principals, approval requirements, tool boundaries, and evidence requirements.
4. **Behavioral divergence is evidence, not permission.** A difference between test-like and deployment-like behavior must be surfaced as a finding or regression. It must never automatically widen permissions or trigger self-modification.
5. **Monitoring must not depend on private chain-of-thought access.** Governance evidence should rely on observable requests, tool/action attempts, approvals, outputs needed for the contract, and retained audit events. Hidden reasoning may be useful to a provider internally but is not a required trust anchor for the harness.
6. **No autonomous recursive-improvement path is implied.** Evaluation-awareness testing may compare model versions or providers, but the harness must not let a model rewrite its own governance policy, promote its own authority, select a more permissive policy, or deploy a successor without an external human-controlled release path.
7. **Uncertainty fails closed for consequential actions.** If deployment parity cannot be established for a consequential path, the result is a release blocker or bounded non-promotion, not a guessed pass.

A future evaluation-awareness matrix should compare at least these contexts while holding the governance contract constant:

- explicit evaluation;
- production-like simulation;
- minimally signaled or blinded evaluation where feasible and ethical;
- adversarially varied presentation of the same authority boundary; and
- a deterministic control case that does not require a live provider.

The first public alpha does **not** claim that this deployment-parity matrix is implemented or that evaluation awareness has been solved. Until executable paired-context tests and retained evidence exist, this section defines the required boundary and release posture only.

## Authority path

Every requested action is evaluated against the principal's explicit grants. Consequential actions fail closed unless a human approval is present. Model principals are categorically blocked from modifying policy or granting authority.

For consequential actions, the harness canonicalizes `{version, action, target, summary, parameters}` and computes a SHA-256 request fingerprint. A changed action, target, summary, or parameter invalidates the approval.

## Approval authentication path

`signHumanApproval()` signs a canonical Ed25519 envelope containing approval ID, approver identity, action, target, request fingerprint, single-use nonce, issuance/expiry fields, signing key ID, algorithm, and envelope version.

`authorizeSigned()` accepts that signature only against an explicit active trusted-key record supplied by the embedding application.

## Single-use consumption path

After signature and authority checks pass, `authorizeSigned()` asks an `ApprovalConsumptionStore` to consume the approval nonce. A nonce is not consumed for an invalid signature or a request that does not match the approval.

`InMemoryApprovalConsumptionStore` provides single-process replay protection. `DirectoryApprovalConsumptionStore` derives a non-sensitive storage key from approver identity, signing-key ID, and a SHA-256 hash of the nonce. It claims that key with atomic exclusive file creation. If the file already exists, the exact signed approval has already been consumed and authorization fails closed.

The consumption receipt records the approval ID, approver, signing-key ID, request fingerprint, nonce hash, consumption time, and a record hash. It does not record the raw nonce or private key.

## Durable evidence path

`GovernanceHarness` accepts any `AuditLedger` implementation. The in-memory ledger remains the zero-dependency default.

`DirectoryAuditLedger` stores each event in a sequence-numbered file. Each append reloads and verifies the retained chain, computes the next event against the previous hash, and creates the next sequence file exclusively. A competing writer that wins the sequence causes the loser to reload and retry rather than overwrite or fork that sequence.

The ledger therefore survives process restart and detects malformed retained chains. A retained `EvidenceReceipt` or trusted external head can be used to compare a later chain head.

## Study path

Reasoning providers receive a bounded objective and return advisory text only. Their output does not carry execution semantics. A study may create an `observed` lesson candidate only after at least two providers succeed. The candidate cannot change permissions, policy, or runtime authority and remains subject to human review.

## Failure model

The harness intentionally prefers denial or non-promotion over guessed success. Missing approval, expired approval, request-fingerprint mismatch, invalid signature, unknown/revoked key, replayed nonce, consumption-store failure, unavailable providers, malformed input, and authority mismatch fail closed.

Provider API failures are converted into `unavailable` study results; the evaluation matrix surfaces bounded live-provider failures as explicit critical regressions rather than replacing them with simulated success.

## Current hardening boundary

The directory-backed stores are a portable reference implementation for a trusted local/shared filesystem. They are not a distributed consensus system, WORM store, remote transparency log, hardware security module, or trusted timestamp service. Production deployments still need environment-appropriate identity proofing, key custody, trusted time, durable revocation distribution, storage hardening, backup/replication, and independent verification.
