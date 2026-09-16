# Independent Evaluator Receipts

AMAN Governance Harness treats a candidate's claims and an evaluator's observations as different trust domains.

An evaluation result is approval-grade only when it is represented by a receipt that binds the result to the exact candidate, system version, evaluation case, case version, fixture, evaluator, observation source, evidence references, and observation time.

## Core rule

Candidate claims may be retained as advisory information, but they must not determine the evaluator score or pass/fail result.

A valid receipt therefore requires `candidateClaimUsedForScoring: false`.

## Receipt verification

`verifyEvaluationReceipt()` fails closed when any of the following is true:

- candidate or system-version identity does not match the expected subject;
- the evaluator is the same identity as the candidate source;
- evaluator identity or version is missing;
- the observation source is not explicitly recognized by policy;
- case ID, case version, fixture ID, or minimum score does not match policy;
- candidate claims are not explicitly excluded from scoring;
- pass is claimed below the required minimum score;
- pass and critical regression are claimed at the same time;
- critical-regression metadata is internally inconsistent;
- evidence references are empty; or
- the observation timestamp is invalid.

A failed independent evaluation can still be a valid receipt. Valid evidence is not the same as approval eligibility. A receipt with `passed: false` remains retainable evidence but cannot authorize advancement.

## Bundle verification

`verifyEvaluationReceiptBundle()` applies the same contract across a required evaluation matrix.

Approval eligibility requires exactly one valid receipt for every required case. Missing, duplicate, unexpected, invalid, or failed cases block the bundle.

The harness deliberately does not infer independence from the number of model outputs. The embedding system defines recognized observation sources and evaluator identities, and must not represent shared orchestration or shared control-plane paths as independent evidence unless that independence is justified externally.

## Separation from human approval

Evaluator receipts establish evaluation evidence only. They do not themselves authorize execution, policy change, persistence, deployment, or authority expansion.

Human authorization remains a separate bounded decision using the harness's request-bound signed-approval path.

## Non-claims

This alpha contract does not provide remote attestation, hardware-rooted evaluator identity, distributed consensus, trusted time, transparency-log anchoring, or certification. It defines a deterministic verification boundary that embedding systems can strengthen with those mechanisms.
