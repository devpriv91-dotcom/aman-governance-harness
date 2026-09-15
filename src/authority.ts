import { randomUUID } from "node:crypto";
import { fingerprintRequest } from "./integrity.ts";
import type {
  AuthorityDecision,
  HumanApproval,
  Principal,
  RequestedAction
} from "./types.ts";

const CONSEQUENTIAL = new Set(["persist", "execute", "modify_policy", "grant_authority"]);
const MODEL_HARD_DENY = new Set(["modify_policy", "grant_authority"]);

export interface CreateHumanApprovalOptions {
  approvedBy: string;
  request: RequestedAction;
  approvalId?: string;
  nonce?: string;
  issuedAt?: string;
  expiresAt?: string;
}

export function createHumanApproval(options: CreateHumanApprovalOptions): HumanApproval {
  const approvedBy = options.approvedBy.trim();
  if (!approvedBy) throw new Error("approvedBy is required");

  const approvalId = options.approvalId?.trim() || randomUUID();
  const nonce = options.nonce?.trim() || randomUUID();
  if (approvalId.length < 8) throw new Error("approvalId must be at least 8 characters");
  if (nonce.length < 16) throw new Error("approval nonce must be at least 16 characters");

  const issuedAt = options.issuedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(issuedAt))) throw new Error("issuedAt must be a valid date-time");
  if (options.expiresAt && !Number.isFinite(Date.parse(options.expiresAt))) {
    throw new Error("expiresAt must be a valid date-time");
  }

  return {
    approvalId,
    approvedBy,
    action: options.request.action,
    target: options.request.target,
    requestFingerprint: fingerprintRequest(options.request),
    nonce,
    issuedAt,
    ...(options.expiresAt ? { expiresAt: options.expiresAt } : {})
  };
}

export function evaluateAuthority(
  principal: Principal,
  request: RequestedAction,
  approval?: HumanApproval
): AuthorityDecision {
  const requestFingerprint = fingerprintRequest(request);

  if (principal.kind === "model" && MODEL_HARD_DENY.has(request.action)) {
    return {
      allowed: false,
      reason: "model principals cannot modify policy or grant authority",
      requiresHumanReview: true,
      requestFingerprint
    };
  }

  if (!principal.grants.includes(request.action)) {
    return {
      allowed: false,
      reason: `principal is not granted ${request.action}`,
      requiresHumanReview: CONSEQUENTIAL.has(request.action),
      requestFingerprint
    };
  }

  if (CONSEQUENTIAL.has(request.action)) {
    if (!approval) {
      return {
        allowed: false,
        reason: "consequential actions require explicit human approval",
        requiresHumanReview: true,
        requestFingerprint
      };
    }

    if (!approval.approvedBy.trim()) {
      return {
        allowed: false,
        reason: "human approval is missing an approver identity",
        requiresHumanReview: true,
        requestFingerprint
      };
    }

    if (!approval.nonce || approval.nonce.trim().length < 16) {
      return {
        allowed: false,
        reason: "human approval is missing a valid single-use nonce",
        requiresHumanReview: true,
        requestFingerprint
      };
    }

    const expired = approval.expiresAt && Date.parse(approval.expiresAt) <= Date.now();
    const humanReadableMismatch = approval.action !== request.action || approval.target !== request.target;
    const fingerprintMismatch = approval.requestFingerprint !== requestFingerprint;

    if (expired || humanReadableMismatch || fingerprintMismatch) {
      return {
        allowed: false,
        reason: expired
          ? "human approval expired"
          : fingerprintMismatch
            ? "human approval fingerprint does not match the requested execution intent"
            : "human approval does not match the requested action",
        requiresHumanReview: true,
        requestFingerprint
      };
    }
  }

  return {
    allowed: true,
    reason: "explicit grant and request-bound human approval are present",
    requiresHumanReview: false,
    requestFingerprint,
    ...(approval ? { matchedApprovalId: approval.approvalId } : {})
  };
}
