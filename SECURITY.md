# Security Policy

AMAN Governance Harness is a reference project, not a production authorization service.

## Security invariants

Contributions must preserve these invariants:

1. Model output is untrusted advisory material.
2. A model cannot grant itself authority or modify the policy that governs it.
3. Consequential actions require explicit, request-bound human approval.
4. Changing an approved action, target, summary, or parameter invalidates the approval fingerprint.
5. Signed approvals verify only against an explicit active trusted-key record matching both key ID and approver identity.
6. The single-use nonce is covered by the Ed25519 signature and is consumed only after the exact requested intent passes authority checks.
7. A consumed nonce cannot authorize the same action a second time through the same durable consumption store.
8. Authorization evidence is hash chained and can be reloaded and verified by the durable reference ledger.
9. Missing approvals, invalid signatures, revoked keys, replayed nonces, unavailable stores, malformed inputs, and ambiguous authority fail closed.
10. Tests use synthetic or irreversibly de-identified data.
11. Secrets, credentials, customer records, private prompts, production access tokens, private signing keys, and raw approval nonces must never be committed to public evidence.

## Cryptographic scope

SHA-256 fingerprints provide request integrity binding. Ed25519 signatures authenticate an approval only relative to the trusted public-key set supplied by the embedding application. Nonce consumption provides replay resistance only within the consistency boundary of the configured consumption store.

The directory-backed reference stores rely on local/shared filesystem atomic exclusive creation. They are not a distributed lock service, HSM, WORM store, trusted timestamp service, or remote transparency log.

The hash chain detects retained-content/order corruption and can be anchored by an independently retained receipt or head. It does not stop an attacker with complete write access from replacing the entire chain and recomputing hashes. Production deployments need identity proofing, secure key management, trusted time, durable revocation/replay state, hardened storage, external anchoring where appropriate, and independent verification.

## Reporting

Do not open a public issue containing a credential, private key, raw approval nonce, exploit payload against a real system, customer data, or other sensitive material. Use GitHub's private vulnerability-reporting channel when it is enabled for the public repository. If that channel is unavailable, contact the maintainer through the repository owner's GitHub profile without including sensitive details, then agree on a private transfer method. Provide the minimum information necessary and prefer a synthetic reproducer.
