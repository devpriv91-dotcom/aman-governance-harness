# Contributing

Contributions are welcome when they strengthen the separation between model capability and operational authority.

Before opening a pull request:

1. Keep examples application-neutral and synthetic.
2. Add or update a regression test for any governance behavior you change.
3. Do not weaken fail-closed behavior for convenience.
4. Do not add autonomous production actions, hidden persistence, self-granted permissions, or audit bypasses.
5. Run `npm run check`.
6. Describe the invariant being protected and avoid claims of production certification or formal verification.

Good first contributions include additional authority-regression fixtures, pluggable audit stores, provider-neutral adapters, evidence receipt formats, and documentation improvements.
