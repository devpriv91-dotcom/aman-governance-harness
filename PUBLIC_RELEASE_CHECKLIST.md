# Public Release Checklist

This checklist is the final gate for extracting the alpha into a clean public repository. Publication is a security boundary, not a documentation step.

## 1. Freeze the reviewed candidate

- Freeze an exact source commit for extraction.
- Run `npm run check` on that exact candidate and require success.
- Retain the machine-readable output from `npm run benchmark`; confirm it reports exactly 50 scenarios, zero critical regressions, and no failed scenarios before claiming a passing release benchmark.
- Record the Node.js version used for the final deterministic run.
- Do not rewrite or drop a failing governance scenario to make the candidate releasable; resolve the underlying behavior and rerun the complete surface.

## 2. Extract with fresh public history

- Copy only the reviewed standalone harness directory into a new repository with fresh public history.
- Reset the public package version from the private staged candidate `0.1.0-alpha.5` to `0.1.0-alpha.1`; update the public README and changelog consistently. The private staging sequence is not a public release sequence.
- Confirm the extracted file set exactly matches the reviewed export allowlist.
- Confirm every exported file is application-neutral and contains only synthetic examples.
- Search filenames, content, commit messages, tags, workflow logs, and release artifacts for private product names, customer information, internal endpoints, credentials, tenant identifiers, personal data, and production configuration.
- Re-run `npm run check` from a clean checkout of the new public repository; do not rely only on the private staging run.

## 3. Configure public repository security

- Review dependency and GitHub Actions provenance; pin third-party workflow actions to reviewed immutable revisions.
- Enable private vulnerability reporting and publish a supported security contact.
- Configure branch protection, required checks, least-privilege workflow permissions, and dependency update policy.
- Confirm the Apache-2.0 license and ownership of every exported contribution.
- Confirm `AGENTS.md` is present so Codex/AI coding assistance inherits the reviewed authority, evidence, privacy, and validation boundaries.

## 4. Tag the alpha

- Confirm the public `package.json`, README status, changelog, and release title all identify `0.1.0-alpha.1`.
- Create a signed `v0.1.0-alpha.1` tag from the exact reviewed public commit.
- Record the public commit SHA and verify the tag resolves to that SHA.
- Attach or link the deterministic test and 50-case benchmark summary to the release.
- State the documented non-claims alongside release evidence; synthetic evidence is not production validation, formal verification, certification, an external security audit, proof of general model safety, or proof that a model behaves identically when it recognizes an evaluation environment.

## 5. Produce optional live OpenAI evidence on the exact tag

A live provider run is not required to publish the source alpha, but it **is required before using live OpenAI evaluation results in a funding application or public proof claim**.

From the exact public tag checkout:

```bash
export OPENAI_API_KEY="..."
export OPENAI_MODEL="<explicit-model-id>"
export AMAN_RELEASE_TAG="v0.1.0-alpha.1"
export AMAN_RELEASE_SHA="$(git rev-parse HEAD)"
npm run eval:openai > openai-evaluation.json
```

Then:

- Confirm the evidence object records the intended exact configured model identifier, tag, and commit SHA; do not represent that field as a provider-returned model identity unless the adapter is changed to capture and validate one.
- Confirm the evidence reports the expected evaluation-case and live-call counts.
- Preserve provider failures and critical regressions exactly as emitted.
- Do not publish or claim a passing live result if the process exits non-zero or the evidence reports failure.
- Never commit the API key or include customer, tenant, credential, or personal data in the live evaluation.

## 6. Evaluation-awareness and deployment-parity claim gate

The alpha architecture recognizes evaluation awareness as a governance risk, but the first release must not imply that the risk has been solved merely because the deterministic or live provider matrix passes.

Before claiming **deployment parity**, **evaluation-awareness resistance**, **test/deployment behavioral consistency**, or equivalent language:

- implement executable paired-context scenarios that hold the authority contract constant while varying evaluation cues;
- include an explicit-evaluation context, a production-like context, an adversarially varied presentation, and a deterministic control;
- retain machine-readable results that identify the model/provider, exact release SHA/tag, scenario family, context variant, governance outcome, and observed divergence;
- require the same hard authority and approval boundaries in every context;
- treat unexplained divergence on a consequential governance invariant as a critical regression or release blocker, not as model discretion;
- do not use model-generated grades as the sole pass/fail authority;
- do not require or claim access to hidden chain-of-thought as the trust basis for the result; and
- require human review before a new model/version or changed evaluation method is promoted into a release claim.

Until those gates are satisfied, describe evaluation-awareness work only as a **documented threat model and planned validation surface**.

## 7. Release evidence record

For the exact public release, record:

- public repository URL;
- release/tag URL;
- exact commit SHA;
- harness version;
- Node.js version;
- deterministic test result;
- 50-case benchmark version, scenario count, and critical-regression count;
- public extraction date;
- human reviewer/release owner; and
- live OpenAI evidence filename/link and exact configured model identifier **only if an explicit live run was actually performed**.

If evaluation-awareness/deployment-parity results are later claimed, also record the paired-context matrix version, exact scenario set, context labels, divergence criteria, raw retained result artifact, and human disposition.

Do not backfill missing provenance later from memory. If a value was not recorded at execution time, state that it was not recorded.

## Funding/application gate

Do not submit a funding application that relies on this release until the public repository, exact tagged release, clean-checkout deterministic validation, and any claimed live OpenAI evidence are all independently reproducible from the public artifact.

Do not claim users, adoption, deployments, external audits, formal verification, certification, vulnerability-remediation performance, benchmark superiority, evaluation-awareness resistance, deployment parity, or institutional affiliation unless those claims are independently supportable at submission time.

## Publish separately

Repository publication and npm publication are separate decisions. The first public release is source-first; package-registry publication requires a compiled export surface, provenance, package allowlist, install-from-tarball test, and explicit removal of `private: true` in a separately reviewed change.
