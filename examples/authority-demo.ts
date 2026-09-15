import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createHumanApproval,
  DirectoryApprovalConsumptionStore,
  DirectoryAuditLedger,
  GovernanceHarness,
  signHumanApproval
} from "../src/index.ts";

const root = mkdtempSync(join(tmpdir(), "aman-governance-demo-"));
const auditDirectory = join(root, "audit");
const consumptionDirectory = join(root, "consumed");

try {
  const releaseService = {
    id: "service:release",
    kind: "service" as const,
    grants: ["execute"] as const
  };
  const approvedRequest = {
    action: "execute" as const,
    target: "release:v0.1.0",
    summary: "Publish the reviewed release",
    parameters: { channel: "public", artifact: "aman-governance-harness" }
  };

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const approval = createHumanApproval({
    approvedBy: "human:owner",
    request: approvedRequest,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  });
  const signedApproval = signHumanApproval(approval, { keyId: "owner-demo-key", privateKeyPem });
  const trustedKeys = [{
    keyId: "owner-demo-key",
    approvedBy: "human:owner",
    algorithm: "Ed25519" as const,
    publicKeyPem,
    status: "active" as const
  }];

  const firstHarness = new GovernanceHarness({
    ledger: new DirectoryAuditLedger(auditDirectory),
    approvalConsumptionStore: new DirectoryApprovalConsumptionStore(consumptionDirectory)
  });

  const altered = firstHarness.authorizeSigned(
    { ...releaseService, grants: [...releaseService.grants] },
    { ...approvedRequest, target: "release:v0.2.0" },
    signedApproval,
    trustedKeys
  );
  console.log("1. Altered target:", altered.decision);

  const exact = firstHarness.authorizeSigned(
    { ...releaseService, grants: [...releaseService.grants] },
    approvedRequest,
    signedApproval,
    trustedKeys
  );
  console.log("2. Exact signed approval:", exact.decision);
  console.log("   Consumption receipt:", exact.approvalConsumption?.receipt);
  console.log("   Audit chain valid:", firstHarness.ledger.verify());

  // Simulate a restart: new harness, new ledger object, new consumption-store
  // object, same durable directories.
  const restartedHarness = new GovernanceHarness({
    ledger: new DirectoryAuditLedger(auditDirectory),
    approvalConsumptionStore: new DirectoryApprovalConsumptionStore(consumptionDirectory)
  });

  const replay = restartedHarness.authorizeSigned(
    { ...releaseService, grants: [...releaseService.grants] },
    approvedRequest,
    signedApproval,
    trustedKeys
  );
  console.log("3. Exact approval replay after restart:", replay.decision);
  console.log("   Replay detected:", replay.approvalConsumption?.replayed);
  console.log("   Durable audit events:", restartedHarness.ledger.list().length);
  console.log("   Durable audit chain valid:", restartedHarness.ledger.verify());

  const study = await restartedHarness.runStudy({
    objective: "Compare two safe recovery approaches and identify uncertainty.",
    providers: [
      { name: "mock-a", reason: async () => "Prefer reversible recovery with independent verification." },
      { name: "mock-b", reason: async () => "Preserve evidence, verify state, and require human approval before action." }
    ]
  });
  console.log("4. Bounded study status:", study.status);
  console.log("   Lesson status:", study.lessonCandidate?.status ?? null);
  console.log("   Authority changed:", study.authorityChanged);
  console.log("   Final durable audit chain valid:", restartedHarness.ledger.verify());
} finally {
  rmSync(root, { recursive: true, force: true });
}
