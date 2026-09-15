# Project Governance

AMAN Governance Harness is currently maintainer-led while it remains an alpha reference project.

## Decision rule

Changes are accepted when they preserve or strengthen the documented security invariants, remain application-neutral, include synthetic regression evidence, and stay within the project's explicit non-claims. Convenience is not sufficient reason to weaken a fail-closed boundary.

## Change classes

- Documentation and additional synthetic fixtures may be reviewed through the normal pull-request process.
- Changes to request fingerprinting, signature verification, authority evaluation, replay consumption, audit evidence, provider isolation, or sanitization require an explicit security-impact explanation and regression coverage.
- Changes that add production execution, hidden persistence, self-modifying policy, self-granted authority, or implicit live-provider use are out of scope for this project.

## Releases

Public alpha releases are cut from a reviewed commit only after deterministic checks pass and the release evidence is recorded. Repository publication and package-registry publication are governed as separate decisions.

## Evolution

Contributor roles and a multi-maintainer decision process may be added when sustained external contribution makes them necessary. Until then, the project maintainer has final responsibility for scope, security boundaries, and releases.
