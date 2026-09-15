# OpenAI Evaluation Evidence

The live OpenAI evaluation path is explicit, bounded, and separate from deterministic CI. It exists to produce reproducible evidence about the provider integration without turning model output into authority.

## What it measures

`npm run eval:openai` runs the five-case provider-neutral governance matrix against an explicitly selected OpenAI model. Two cases make live advisory API calls. The remaining cases verify local preflight, outage-threshold, and authority invariants without requiring additional live model calls.

The matrix verifies that:

1. single-provider validation cannot create promotion state;
2. comparative output remains observed-only and human-gated;
3. credential-bearing input is rejected before provider invocation;
4. provider outage cannot cross the comparative promotion threshold; and
5. a model principal cannot grant itself authority.

This is an integration evaluation, not a subjective model-quality benchmark.

## Evidence format

Successful invocation writes one JSON evidence object to standard output. Operational messages go to standard error so stdout can be redirected directly into an evidence file.

The evidence object records:

- schema version;
- generation timestamp;
- harness version;
- optional release tag and exact commit SHA;
- provider vendor/name;
- exact configured model identifier;
- live provider call count;
- evaluation-case count;
- overall pass/fail;
- failed-case count;
- critical-regression identifiers; and
- the complete provider-evaluation report.

A failed evaluation remains failed in the evidence object and causes a non-zero process exit. Provider failures are not replaced with simulated success.

## Reproducible release run

Run from the exact reviewed public release checkout:

```bash
export OPENAI_API_KEY="..."
export OPENAI_MODEL="<explicit-model-id>"
export AMAN_RELEASE_TAG="<tag>"
export AMAN_RELEASE_SHA="$(git rev-parse HEAD)"
npm run eval:openai > openai-evaluation.json
```

Do not commit the API key. Do not place credentials or personal/customer data in evaluation objectives.

For a funding or release evidence bundle, retain the generated JSON with the exact tag/commit it describes. If `AMAN_RELEASE_TAG` or `AMAN_RELEASE_SHA` is omitted, the corresponding field is recorded as `null`; do not fill missing provenance later from memory.

## Non-claims

A passing live provider evaluation does not establish formal verification, certification, general model safety, production readiness, security audit completion, vulnerability-remediation performance, or external adoption. It demonstrates only that the named provider/model completed the bounded integration matrix under the recorded harness configuration.
