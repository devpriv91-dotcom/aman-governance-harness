# Trust Model

AMAN Governance Harness treats model reasoning, authority, human approval, replay state, and evidence integrity as separate trust questions.

## What the alpha can demonstrate

A request fingerprint binds an approval to the exact action, target, summary, and parameter payload. An Ed25519 signature authenticates that approval relative to a caller-supplied trusted public-key set. A signed nonce gives the approval a unique single-use identity. A consumption store can reject reuse of that identity. A retained hash chain and evidence receipt can reveal later changes when compared against a trusted prior receipt or chain head.

## Authorization order

`authorizeSigned()` applies the signed path in a fail-closed order:

1. cryptographically verify the approval against an active trusted key;
2. evaluate the principal grant and exact request fingerprint;
3. consume the signed nonce through the configured consumption store;
4. reject a previously consumed nonce; and
5. append the decision, verification result, nonce hash, and consumption-record hash to evidence.

An invalid or mismatched request is never allowed merely because it carries a valid signature. An invalid request also does not burn the valid nonce; consumption happens only after the exact approved intent passes authority checks.

## Durable reference stores

`DirectoryApprovalConsumptionStore` uses atomic exclusive file creation. Two cooperating processes sharing the same filesystem directory cannot both create the same nonce-claim file successfully.

`DirectoryAuditLedger` uses exclusive sequence-file creation and chain verification to continue retained audit evidence after restart. It is intentionally simple and inspectable.

## What the alpha deliberately does not claim

The harness does not decide whether a public key truly belongs to a real-world human. The embedding application must establish that trust relationship. It does not provide hardware-backed key custody, trusted time, certificate infrastructure, organization identity proofing, distributed consensus, a remote transparency service, or a WORM evidence system.

A hash chain by itself is not magic immutability: an attacker who can rewrite all retained event files and recompute all hashes could manufacture a new internally consistent chain. Strong deployments should anchor receipts or chain heads outside the mutable store and use storage controls appropriate to their threat model.

## Trust-store rule

A signed approval is accepted only when the signature algorithm is Ed25519, the key ID and `approvedBy` identity match an active trusted key, the signature verifies over the complete canonical approval envelope including its nonce, the normal request-fingerprint/authority checks pass, and the nonce has not already been consumed.

A revoked key, altered approval, unknown key, expired approval, changed request, consumed nonce, or unavailable consumption store fails closed.

## Key handling

Private signing keys and raw approval nonces are never written to audit evidence by the harness. The demo generates an ephemeral key pair solely to make the trust flow reproducible. Production key creation, custody, rotation, revocation distribution, recovery, and identity binding remain responsibilities of the embedding system.
