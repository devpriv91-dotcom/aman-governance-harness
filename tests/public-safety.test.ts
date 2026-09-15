import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { createHumanApproval, signHumanApproval, verifySignedHumanApproval } from "../src/index.ts";

test("signed approvals require an explicit bounded validity interval", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const request = { action: "execute" as const, target: "synthetic:release" };
  const approval = createHumanApproval({ approvedBy: "human:reviewer", request });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  assert.throws(() => signHumanApproval(approval, { keyId: "reviewer-key", privateKeyPem }), /explicit expiresAt/);

  const expiredShape = { approval: { ...approval, expiresAt: approval.issuedAt }, keyId: "reviewer-key", algorithm: "Ed25519" as const, signature: "invalid" };
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const result = verifySignedHumanApproval(expiredShape, [{ keyId: "reviewer-key", approvedBy: "human:reviewer", algorithm: "Ed25519", publicKeyPem, status: "active" }]);
  assert.equal(result.valid, false);
  assert.match(result.reason, /validity interval/);
});
