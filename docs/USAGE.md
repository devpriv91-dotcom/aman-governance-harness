# Safe Usage

This alpha is designed to be inspected and tested before it is embedded anywhere. It does not execute the action it evaluates.

## Run the deterministic evidence

```bash
npm run check
```

That command runs the synthetic regression suite, the signed-approval and replay demo, and the provider-neutral governance matrix. It makes no network requests.

## Evaluate a consequential request

The secure demonstration path is:

1. Describe the complete requested intent, including action, target, summary, and parameters.
2. Create a short-lived approval with an explicit expiration.
3. Sign the complete approval envelope with an Ed25519 private key held outside the harness.
4. Supply the corresponding active trusted public-key record.
5. Call `authorizeSigned()` with durable consumption and audit stores when restart-safe evidence is required.
6. Execute nothing merely because the harness returns `allowed`; the embedding application must separately enforce its own controls and bind execution to the same request fingerprint.

`evaluateAuthority()` and `authorize()` expose the policy/evidence layer for tests and non-consequential decisions. They do not authenticate a human signature or provide replay protection. Do not use their unsigned approval input as a production approval mechanism.

## Provider evaluation

`npm run eval` uses a deterministic local provider fixture. `npm run eval:openai` is an explicit, optional live test that requires an API key and incurs provider usage. The live command is not part of CI and does not give the provider tools or execution authority.

## Integration warning

Treat every `allowed` result as one input to an independently secured execution system—not as the execution itself. Preserve least privilege, independently bind the executed payload, protect keys and replay state, and externally anchor evidence when your threat model requires it.
