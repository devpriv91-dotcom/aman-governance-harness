import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createHumanApproval,
  DirectoryApprovalConsumptionStore,
  DirectoryAuditLedger,
  evaluateAuthority,
  GovernanceHarness,
  sanitizeObjective,
  signHumanApproval,
  verifyAuditChain,
  verifyConsumptionReceipt,
  verifyReceipt
} from "../src/index.ts";

const model = { id: "model:test", kind: "model" as const, grants: ["reason", "recommend"] as const };

function signingFixture() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  return { privateKeyPem, publicKeyPem };
}

function signedExecutionFixture() {
  const { privateKeyPem, publicKeyPem } = signingFixture();
  const service = { id: "service:release", kind: "service" as const, grants: ["execute"] as const };
  const request = { action: "execute" as const, target: "release:v0.1.0", parameters: { channel: "public" } };
  const approval = createHumanApproval({ approvedBy: "human:owner", request, expiresAt: "2099-01-01T00:00:00Z" });
  const signed = signHumanApproval(approval, { keyId: "owner-key-1", privateKeyPem });
  const trustedKeys = [{ keyId: "owner-key-1", approvedBy: "human:owner", algorithm: "Ed25519" as const, publicKeyPem, status: "active" as const }];
  return { service, request, approval, signed, trustedKeys };
}

test("unauthorized authority expansion is rejected", () => {
  const decision = evaluateAuthority(
    { ...model, grants: [...model.grants] },
    { action: "grant_authority", target: "self" }
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresHumanReview, true);
});

test("model output remains advisory and cannot execute", () => {
  const decision = evaluateAuthority(
    { ...model, grants: [...model.grants] },
    { action: "execute", target: "production" }
  );
  assert.equal(decision.allowed, false);
});

test("lesson candidates cannot silently change permissions", async () => {
  const harness = new GovernanceHarness();
  const result = await harness.runStudy({
    objective: "Compare safe recovery options",
    providers: [
      { name: "peer-a", reason: async () => "memo a" },
      { name: "peer-b", reason: async () => "memo b" }
    ]
  });
  assert.equal(result.lessonCandidate?.status, "observed");
  assert.equal(result.lessonCandidate?.authorityChanged, false);
  assert.equal(result.lessonCandidate?.permissionsChanged, false);
  assert.equal(result.requiresHumanReview, true);
});

test("provider failure fails closed below comparative threshold", async () => {
  const harness = new GovernanceHarness();
  const result = await harness.runStudy({
    objective: "Compare safe recovery options",
    providers: [
      { name: "peer-a", reason: async () => "memo a" },
      { name: "peer-b", reason: async () => { throw new Error("offline"); } }
    ]
  });
  assert.equal(result.status, "partial");
  assert.equal(result.lessonCandidate, null);
});

test("credentials are rejected and personal data is redacted", () => {
  assert.throws(() => sanitizeObjective("Analyze bearer abcdefghijklmnopqrstuvwxyz"), /Credentials or secrets/);
  const clean = sanitizeObjective("Review jane@example.com and +1 (501) 555-1212");
  assert.equal(clean.objective.includes("jane@example.com"), false);
  assert.equal(clean.objective.includes("555-1212"), false);
  assert.deepEqual(clean.safetyFlags, ["personal_data_redacted"]);
});

test("request-bound approval allows only the exact approved execution intent", () => {
  const service = { id: "service:release", kind: "service" as const, grants: ["execute"] as const };
  const request = {
    action: "execute" as const,
    target: "release:v0.1.0",
    summary: "Publish reviewed release",
    parameters: { channel: "public", dryRun: false }
  };
  const approval = createHumanApproval({
    approvedBy: "human:owner",
    request,
    issuedAt: "2026-09-11T12:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z"
  });

  const allowed = evaluateAuthority({ ...service, grants: [...service.grants] }, request, approval);
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.matchedApprovalId, approval.approvalId);

  const mutated = evaluateAuthority(
    { ...service, grants: [...service.grants] },
    { ...request, parameters: { channel: "production", dryRun: false } },
    approval
  );
  assert.equal(mutated.allowed, false);
  assert.match(mutated.reason, /fingerprint/);
});

test("approval cannot be replayed against a different target", () => {
  const service = { id: "service:release", kind: "service" as const, grants: ["execute"] as const };
  const request = { action: "execute" as const, target: "release:v0.1.0" };
  const approval = createHumanApproval({ approvedBy: "human:owner", request, expiresAt: "2099-01-01T00:00:00Z" });
  const replay = evaluateAuthority(
    { ...service, grants: [...service.grants] },
    { ...request, target: "release:v0.2.0" },
    approval
  );
  assert.equal(replay.allowed, false);
});

test("authorization produces a verifiable tamper-evident evidence receipt", () => {
  const harness = new GovernanceHarness();
  const service = { id: "service:release", kind: "service" as const, grants: ["execute"] as const };
  const request = { action: "execute" as const, target: "release:v0.1.0" };
  const approval = createHumanApproval({ approvedBy: "human:owner", request, expiresAt: "2099-01-01T00:00:00Z" });

  const result = harness.authorize({ ...service, grants: [...service.grants] }, request, approval);
  const events = harness.ledger.list();
  assert.equal(result.decision.allowed, true);
  assert.equal(events.length, 1);
  assert.equal(verifyReceipt(events[0], result.receipt), true);
  assert.equal(verifyAuditChain(events), true);
  assert.equal(result.auditDigest, result.receipt.eventHash);
});

test("tampering with exported audit evidence is detectable", () => {
  const harness = new GovernanceHarness();
  harness.authorize(
    { id: "model:test", kind: "model", grants: ["reason"] },
    { action: "execute", target: "production" }
  );
  const events = harness.ledger.list();
  assert.equal(verifyAuditChain(events), true);

  const tampered = structuredClone(events);
  tampered[0].details.reason = "rewritten after the fact";
  assert.equal(verifyAuditChain(tampered), false);
});

test("canonical request fingerprinting fails closed on ambiguous values", () => {
  const service = { id: "service:release", kind: "service" as const, grants: ["execute"] as const };
  const sparse = [] as unknown[];
  sparse.length = 1;
  assert.throws(
    () => evaluateAuthority(
      { ...service, grants: [...service.grants] },
      { action: "execute", target: "release", parameters: sparse as never }
    ),
    /sparse arrays/
  );
});

test("signed approval authenticates against an active trusted Ed25519 key", () => {
  const { service, request, signed, trustedKeys } = signedExecutionFixture();
  const harness = new GovernanceHarness();
  const result = harness.authorizeSigned({ ...service, grants: [...service.grants] }, request, signed, trustedKeys);
  assert.equal(result.approvalVerification?.valid, true);
  assert.equal(result.approvalConsumption?.consumed, true);
  assert.equal(result.decision.allowed, true);
  assert.equal(harness.ledger.verify(), true);
  assert.equal(JSON.stringify(harness.ledger.list()).includes("PRIVATE KEY"), false);
});

test("tampering with a signed approval invalidates the signature", () => {
  const { service, request, signed, trustedKeys } = signedExecutionFixture();
  const harness = new GovernanceHarness();
  signed.approval.target = "release:v9.9.9";

  const result = harness.authorizeSigned({ ...service, grants: [...service.grants] }, request, signed, trustedKeys);
  assert.equal(result.approvalVerification?.valid, false);
  assert.equal(result.decision.allowed, false);
  assert.match(result.decision.reason, /signature/);
});

test("revoked approver key fails closed", () => {
  const { service, request, signed, trustedKeys } = signedExecutionFixture();
  const harness = new GovernanceHarness();
  const revoked = trustedKeys.map((key) => ({ ...key, status: "revoked" as const }));

  const result = harness.authorizeSigned({ ...service, grants: [...service.grants] }, request, signed, revoked);
  assert.equal(result.approvalVerification?.valid, false);
  assert.equal(result.decision.allowed, false);
  assert.match(result.decision.reason, /revoked/);
});

test("the exact same signed approval is single-use within one harness", () => {
  const { service, request, signed, trustedKeys } = signedExecutionFixture();
  const harness = new GovernanceHarness();
  const first = harness.authorizeSigned({ ...service, grants: [...service.grants] }, request, signed, trustedKeys);
  const replay = harness.authorizeSigned({ ...service, grants: [...service.grants] }, request, signed, trustedKeys);

  assert.equal(first.decision.allowed, true);
  assert.equal(first.approvalConsumption?.consumed, true);
  assert.equal(replay.decision.allowed, false);
  assert.equal(replay.approvalConsumption?.replayed, true);
  assert.match(replay.decision.reason, /already been consumed/);
});

test("durable consumption blocks replay after a harness restart", () => {
  const root = mkdtempSync(join(tmpdir(), "aman-consumption-"));
  try {
    const { service, request, signed, trustedKeys } = signedExecutionFixture();
    const storeDirectory = join(root, "consumed");

    const firstHarness = new GovernanceHarness({
      approvalConsumptionStore: new DirectoryApprovalConsumptionStore(storeDirectory)
    });
    const first = firstHarness.authorizeSigned({ ...service, grants: [...service.grants] }, request, signed, trustedKeys);
    assert.equal(first.decision.allowed, true);
    assert.equal(first.approvalConsumption?.receipt ? verifyConsumptionReceipt(first.approvalConsumption.receipt) : false, true);

    const restartedHarness = new GovernanceHarness({
      approvalConsumptionStore: new DirectoryApprovalConsumptionStore(storeDirectory)
    });
    const replay = restartedHarness.authorizeSigned({ ...service, grants: [...service.grants] }, request, signed, trustedKeys);
    assert.equal(replay.decision.allowed, false);
    assert.equal(replay.approvalConsumption?.replayed, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("durable audit ledger survives restart and continues one verified chain", () => {
  const root = mkdtempSync(join(tmpdir(), "aman-audit-"));
  try {
    const ledgerDirectory = join(root, "audit");
    const firstHarness = new GovernanceHarness({ ledger: new DirectoryAuditLedger(ledgerDirectory) });
    firstHarness.authorize(
      { id: "model:test", kind: "model", grants: ["reason"] },
      { action: "execute", target: "production" }
    );

    const restartedHarness = new GovernanceHarness({ ledger: new DirectoryAuditLedger(ledgerDirectory) });
    restartedHarness.authorize(
      { id: "model:test", kind: "model", grants: ["reason"] },
      { action: "grant_authority", target: "self" }
    );

    const events = restartedHarness.ledger.list();
    assert.equal(events.length, 2);
    assert.equal(events[0].sequence, 1);
    assert.equal(events[1].sequence, 2);
    assert.equal(events[1].previousHash, events[0].eventHash);
    assert.equal(restartedHarness.ledger.verify(), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("durable replay protection and durable audit survive the same restart", () => {
  const root = mkdtempSync(join(tmpdir(), "aman-durable-"));
  try {
    const { service, request, signed, trustedKeys } = signedExecutionFixture();
    const ledgerDirectory = join(root, "audit");
    const consumptionDirectory = join(root, "consumed");

    const firstHarness = new GovernanceHarness({
      ledger: new DirectoryAuditLedger(ledgerDirectory),
      approvalConsumptionStore: new DirectoryApprovalConsumptionStore(consumptionDirectory)
    });
    const first = firstHarness.authorizeSigned({ ...service, grants: [...service.grants] }, request, signed, trustedKeys);
    assert.equal(first.decision.allowed, true);

    const restartedHarness = new GovernanceHarness({
      ledger: new DirectoryAuditLedger(ledgerDirectory),
      approvalConsumptionStore: new DirectoryApprovalConsumptionStore(consumptionDirectory)
    });
    const replay = restartedHarness.authorizeSigned({ ...service, grants: [...service.grants] }, request, signed, trustedKeys);

    assert.equal(replay.decision.allowed, false);
    assert.equal(replay.approvalConsumption?.replayed, true);
    assert.equal(restartedHarness.ledger.list().length, 2);
    assert.equal(restartedHarness.ledger.verify(), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
