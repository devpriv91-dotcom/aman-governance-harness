import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { canonicalJson } from "./integrity.ts";
import type { ApprovalVerification, HumanApproval, SignedHumanApproval, TrustedApproverKey } from "./types.ts";

function signingPayload(approval: HumanApproval, keyId: string): string {
  return canonicalJson({ version: 2, algorithm: "Ed25519", keyId, approval: {
    approvalId: approval.approvalId, approvedBy: approval.approvedBy, action: approval.action,
    target: approval.target, requestFingerprint: approval.requestFingerprint, nonce: approval.nonce,
    issuedAt: approval.issuedAt, expiresAt: approval.expiresAt ?? null
  }});
}

export interface SignHumanApprovalOptions { keyId: string; privateKeyPem: string; }

export function signHumanApproval(approval: HumanApproval, options: SignHumanApprovalOptions): SignedHumanApproval {
  const keyId = options.keyId.trim();
  if (!keyId) throw new Error("keyId is required");
  if (!approval.nonce || approval.nonce.trim().length < 16) throw new Error("approval nonce must be present before signing");
  if (!approval.expiresAt) throw new Error("signed approvals require an explicit expiresAt");
  const issuedAt = Date.parse(approval.issuedAt);
  const expiresAt = Date.parse(approval.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) {
    throw new Error("signed approval expiry must be later than issuance");
  }
  if (!options.privateKeyPem.includes("PRIVATE KEY")) throw new Error("an Ed25519 private key in PEM format is required");
  const privateKey = createPrivateKey(options.privateKeyPem);
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("approval signing requires an Ed25519 private key");
  const signature = sign(null, Buffer.from(signingPayload(approval, keyId), "utf8"), privateKey).toString("base64url");
  return { approval: structuredClone(approval), keyId, algorithm: "Ed25519", signature };
}

export function verifySignedHumanApproval(signed: SignedHumanApproval, trustedKeys: readonly TrustedApproverKey[]): ApprovalVerification {
  const base = { keyId: String(signed?.keyId ?? ""), approvedBy: String(signed?.approval?.approvedBy ?? "") };
  if (signed?.algorithm !== "Ed25519") return { ...base, valid: false, reason: "unsupported approval signature algorithm" };
  if (!signed?.approval?.nonce || String(signed.approval.nonce).trim().length < 16) return { ...base, valid: false, reason: "signed approval is missing a valid single-use nonce" };
  if (!signed?.approval?.expiresAt) return { ...base, valid: false, reason: "signed approval is missing an explicit expiry" };
  const issuedAt = Date.parse(String(signed.approval.issuedAt));
  const expiresAt = Date.parse(String(signed.approval.expiresAt));
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) return { ...base, valid: false, reason: "signed approval has an invalid validity interval" };
  const trusted = trustedKeys.find((key) => key.keyId === signed.keyId && key.approvedBy === signed.approval.approvedBy);
  if (!trusted) return { ...base, valid: false, reason: "no trusted approver key matches the approval identity" };
  if (trusted.status !== "active") return { ...base, valid: false, reason: "approver key is revoked" };
  if (trusted.algorithm !== "Ed25519") return { ...base, valid: false, reason: "trusted key algorithm mismatch" };
  try {
    const publicKey = createPublicKey(trusted.publicKeyPem);
    if (publicKey.asymmetricKeyType !== "ed25519") return { ...base, valid: false, reason: "trusted key is not Ed25519" };
    const signature = Buffer.from(signed.signature, "base64url");
    if (!signature.length) return { ...base, valid: false, reason: "approval signature is empty" };
    const valid = verify(null, Buffer.from(signingPayload(signed.approval, signed.keyId), "utf8"), publicKey, signature);
    return { ...base, valid, reason: valid ? "approval signature verified against an active trusted key" : "approval signature verification failed" };
  } catch {
    return { ...base, valid: false, reason: "approval signature or trusted public key is invalid" };
  }
}
