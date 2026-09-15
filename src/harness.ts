import { randomUUID } from "node:crypto";
import { evaluateAuthority } from "./authority.ts";
import {
  InMemoryApprovalConsumptionStore,
  type ApprovalConsumptionStore
} from "./consumption.ts";
import {
  InMemoryAuditLedger,
  receiptFor,
  type AuditLedger
} from "./evidence.ts";
import { fingerprintRequest, sha256Hex } from "./integrity.ts";
import { sanitizeObjective } from "./sanitize.ts";
import { verifySignedHumanApproval } from "./signatures.ts";
import type {
  ApprovalConsumptionResult,
  ApprovalVerification,
  AuthorityDecision,
  EvidenceReceipt,
  HumanApproval,
  LessonCandidate,
  Principal,
  ProviderResult,
  RequestedAction,
  SignedHumanApproval,
  TrustedApproverKey
} from "./types.ts";

export interface ReasoningProvider {
  name: string;
  reason(objective: string): Promise<string>;
}

export interface StudyOptions {
  objective: string;
  providers: ReasoningProvider[];
  validationOnly?: boolean;
}

export interface StudyResult {
  status: "completed" | "partial" | "failed";
  providerResults: ProviderResult[];
  lessonCandidate: LessonCandidate | null;
  authorityChanged: false;
  permissionsChanged: false;
  requiresHumanReview: true;
  safetyFlags: string[];
  auditDigest: string;
}

export interface AuthorizationResult {
  decision: AuthorityDecision;
  receipt: EvidenceReceipt;
  auditDigest: string;
  approvalVerification?: ApprovalVerification;
  approvalConsumption?: ApprovalConsumptionResult;
}

export interface GovernanceHarnessOptions {
  ledger?: AuditLedger;
  approvalConsumptionStore?: ApprovalConsumptionStore;
}

export class GovernanceHarness {
  readonly ledger: AuditLedger;
  readonly approvalConsumptionStore: ApprovalConsumptionStore;

  constructor(options: GovernanceHarnessOptions = {}) {
    this.ledger = options.ledger ?? new InMemoryAuditLedger();
    this.approvalConsumptionStore = options.approvalConsumptionStore ?? new InMemoryApprovalConsumptionStore();
  }

  #recordAuthorization(
    principal: Principal,
    request: RequestedAction,
    approval: HumanApproval | undefined,
    decision: AuthorityDecision,
    verification?: ApprovalVerification,
    consumption?: ApprovalConsumptionResult
  ): AuthorizationResult {
    const event = this.ledger.append({
      event: decision.allowed ? "authority.allowed" : "authority.denied",
      outcome: decision.allowed ? "recorded" : "denied",
      details: {
        principalId: principal.id,
        principalKind: principal.kind,
        action: request.action,
        target: request.target,
        requestFingerprint: decision.requestFingerprint,
        approvalId: approval?.approvalId ?? null,
        approvedBy: approval?.approvedBy ?? null,
        approvalNonceHash: approval?.nonce ? sha256Hex(approval.nonce) : null,
        signatureVerified: verification?.valid ?? null,
        signingKeyId: verification?.keyId ?? null,
        approvalConsumed: consumption?.consumed ?? null,
        approvalReplayDetected: consumption?.replayed ?? null,
        consumptionRecordHash: consumption?.receipt?.recordHash ?? consumption?.existingReceipt?.recordHash ?? null,
        allowed: decision.allowed,
        reason: decision.reason
      }
    });

    return {
      decision,
      receipt: receiptFor(event),
      auditDigest: this.ledger.digest(),
      ...(verification ? { approvalVerification: verification } : {}),
      ...(consumption ? { approvalConsumption: consumption } : {})
    };
  }

  authorize(
    principal: Principal,
    request: RequestedAction,
    approval?: HumanApproval
  ): AuthorizationResult {
    const decision = evaluateAuthority(principal, request, approval);
    return this.#recordAuthorization(principal, request, approval, decision);
  }

  /**
   * Signed consequential authorization path. A valid approval is consumed only
   * after signature and authority checks pass. Reuse of the same signed nonce
   * is denied by the configured consumption store.
   */
  authorizeSigned(
    principal: Principal,
    request: RequestedAction,
    signedApproval: SignedHumanApproval,
    trustedKeys: readonly TrustedApproverKey[]
  ): AuthorizationResult {
    const verification = verifySignedHumanApproval(signedApproval, trustedKeys);
    if (!verification.valid) {
      const decision: AuthorityDecision = {
        allowed: false,
        reason: `human approval rejected: ${verification.reason}`,
        requiresHumanReview: true,
        requestFingerprint: fingerprintRequest(request)
      };
      return this.#recordAuthorization(principal, request, signedApproval.approval, decision, verification);
    }

    const authorityDecision = evaluateAuthority(principal, request, signedApproval.approval);
    if (!authorityDecision.allowed) {
      return this.#recordAuthorization(
        principal,
        request,
        signedApproval.approval,
        authorityDecision,
        verification
      );
    }

    let consumption: ApprovalConsumptionResult;
    try {
      consumption = this.approvalConsumptionStore.consume(signedApproval);
    } catch {
      const decision: AuthorityDecision = {
        allowed: false,
        reason: "human approval rejected: approval consumption store failed closed",
        requiresHumanReview: true,
        requestFingerprint: authorityDecision.requestFingerprint
      };
      return this.#recordAuthorization(
        principal,
        request,
        signedApproval.approval,
        decision,
        verification
      );
    }

    if (!consumption.consumed) {
      const decision: AuthorityDecision = {
        allowed: false,
        reason: "human approval rejected: signed approval has already been consumed",
        requiresHumanReview: true,
        requestFingerprint: authorityDecision.requestFingerprint
      };
      return this.#recordAuthorization(
        principal,
        request,
        signedApproval.approval,
        decision,
        verification,
        consumption
      );
    }

    return this.#recordAuthorization(
      principal,
      request,
      signedApproval.approval,
      authorityDecision,
      verification,
      consumption
    );
  }

  async runStudy(options: StudyOptions): Promise<StudyResult> {
    const { objective, safetyFlags } = sanitizeObjective(options.objective);
    this.ledger.append({
      event: "study.started",
      outcome: "recorded",
      details: { providerCount: options.providers.length, validationOnly: options.validationOnly === true, safetyFlags }
    });

    const providerResults = await Promise.all(
      options.providers.map(async (provider): Promise<ProviderResult> => {
        try {
          const text = String(await provider.reason(objective)).trim();
          if (!text) throw new Error("provider returned no usable text");
          return { provider: provider.name, status: "completed", text: text.slice(0, 7000) };
        } catch (error) {
          return {
            provider: provider.name,
            status: "unavailable",
            reason: error instanceof Error ? error.message.slice(0, 240) : "provider unavailable"
          };
        }
      })
    );

    const successful = providerResults.filter((result) => result.status === "completed");
    let lessonCandidate: LessonCandidate | null = null;
    if (options.validationOnly !== true && successful.length >= 2) {
      lessonCandidate = {
        id: randomUUID(),
        status: "observed",
        title: objective.slice(0, 120),
        sourceProviders: successful.map((result) => result.provider),
        authorityChanged: false,
        permissionsChanged: false,
        requiresHumanReview: true
      };
    }

    const status = successful.length === options.providers.length
      ? "completed"
      : successful.length > 0
        ? "partial"
        : "failed";

    this.ledger.append({
      event: "study.completed",
      outcome: successful.length ? "recorded" : "denied",
      details: {
        status,
        successfulProviders: successful.map((result) => result.provider),
        lessonCreated: Boolean(lessonCandidate),
        authorityChanged: false,
        permissionsChanged: false
      }
    });

    return {
      status,
      providerResults,
      lessonCandidate,
      authorityChanged: false,
      permissionsChanged: false,
      requiresHumanReview: true,
      safetyFlags,
      auditDigest: this.ledger.digest()
    };
  }
}
