# Changelog

All notable changes to this project will be documented here. The project follows semantic versioning for public alpha releases.

## 0.1.0-alpha.1 — 2026-09-16

- Published the first fresh-history, source-first public alpha of AMAN Governance Harness as signed tag [`v0.1.0-alpha.1`](https://github.com/devpriv91-dotcom/aman-governance-harness/releases/tag/v0.1.0-alpha.1), resolving to [`778b8f4104b68e2648cf98ac4b3427aa85e3a9ef`](https://github.com/devpriv91-dotcom/aman-governance-harness/commit/778b8f4104b68e2648cf98ac4b3427aa85e3a9ef).
- Add public extraction and claim-review gates.
- Require an explicit valid expiry interval before a human approval can be signed or verified.
- Add regression coverage for approval validity intervals.
- Add a 50-scenario machine-readable synthetic governance benchmark covering authority, input safety, provider boundaries, and evidence/replay behavior.
- Tighten secret preflight to reject plain and prefixed private-key envelopes.
- Add machine-readable OpenAI evaluation evidence with exact configured model, harness version, release context, case counts, failures, and critical-regression identifiers.
- Add persistent `AGENTS.md` maintainer instructions that keep Codex/AI coding assistance advisory and preserve authority, evidence, privacy, and test boundaries.
- Rework the public reviewer path around reproducibility, falsifiable proof points, and precise non-claims.
- Clarify source-first release status and the distinction between policy evaluation and cryptographic approval authentication.
- Add the five-case provider-governance matrix and bounded optional OpenAI adapter.
- Add durable replay-consumption and audit-ledger reference implementations.
- Add 22 synthetic regression tests and deterministic demo/evaluation commands.
