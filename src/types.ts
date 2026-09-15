export type AuthorityAction =
  | "reason"
  | "recommend"
  | "persist"
  | "execute"
  | "modify_policy"
  | "grant_authority";

export type PrincipalKind = "human" | "model" | "service";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface Principal {
  id: string;
  kind: PrincipalKind;
  grants: AuthorityAction[];
}

export interface RequestedAction {
  action: AuthorityAction;
  target: string;
  summary?: string;
  parameters?: JsonValue;
}

export interface HumanApproval {
  approvalId: string;
  approvedBy: string;
  action: AuthorityAction;
  target: string;
  requestFingerprint: string;
  nonce: string;
  issuedAt: string;
  expiresAt?: string;
}

export interface SignedHumanApproval {
  approval: HumanApproval;
  keyId: string;
  algorithm: "Ed25519";
  signature: string;
}

export interface TrustedApproverKey {
  keyId: string;
  approvedBy: string;
  algorithm: "Ed25519";
  publicKeyPem: string;
  status: "active" | "revoked";
}

export interface ApprovalVerification {
  valid: boolean;
  reason: string;
  keyId: string;
  approvedBy: string;
}

export interface ApprovalConsumptionReceipt {
  consumptionId: string;
  approvalId: string;
  approvedBy: string;
  signingKeyId: string;
  requestFingerprint: string;
  nonceHash: string;
  consumedAt: string;
  recordHash: string;
}

export interface ApprovalConsumptionResult {
  consumed: boolean;
  replayed: boolean;
  reason: string;
  receipt?: ApprovalConsumptionReceipt;
  existingReceipt?: ApprovalConsumptionReceipt;
}

export interface AuthorityDecision {
  allowed: boolean;
  reason: string;
  requiresHumanReview: boolean;
  requestFingerprint: string;
  matchedApprovalId?: string;
}

export interface ProviderResult {
  provider: string;
  status: "completed" | "unavailable";
  text?: string;
  reason?: string;
}

export interface LessonCandidate {
  id: string;
  status: "observed";
  title: string;
  sourceProviders: string[];
  authorityChanged: false;
  permissionsChanged: false;
  requiresHumanReview: true;
}

export interface AuditEvent {
  id: string;
  sequence: number;
  at: string;
  event: string;
  outcome: "recorded" | "denied";
  details: Record<string, unknown>;
  previousHash: string;
  eventHash: string;
}

export interface EvidenceReceipt {
  eventId: string;
  sequence: number;
  eventHash: string;
  previousHash: string;
}
