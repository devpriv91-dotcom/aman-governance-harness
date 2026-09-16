export interface EvaluationReceipt {
  schemaVersion: 1;
  receiptId: string;
  candidate: {
    id: string;
    systemVersionId: string;
    sourceId: string;
  };
  evaluation: {
    caseId: string;
    caseVersion: number;
    fixtureId: string;
    minimumScore: number;
  };
  evaluator: {
    id: string;
    version: string;
    observationSource: string;
  };
  result: {
    passed: boolean;
    score: number;
    criticalRegression: boolean;
    criticalRegressionCategories: string[];
    candidateClaimUsedForScoring: false;
  };
  evidenceRefs: string[];
  observedAt: string;
}

export interface EvaluationReceiptPolicy {
  candidateId: string;
  systemVersionId: string;
  candidateSourceId: string;
  caseId: string;
  caseVersion: number;
  fixtureId: string;
  minimumScore: number;
  recognizedObservationSources: readonly string[];
}

export interface EvaluationReceiptVerification {
  valid: boolean;
  approvalEligible: boolean;
  reasons: string[];
}

export interface EvaluationReceiptBundlePolicy {
  candidateId: string;
  systemVersionId: string;
  candidateSourceId: string;
  recognizedObservationSources: readonly string[];
  requiredCases: readonly {
    caseId: string;
    caseVersion: number;
    fixtureId: string;
    minimumScore: number;
  }[];
}

export interface EvaluationReceiptBundleVerification {
  complete: boolean;
  valid: boolean;
  approvalEligible: boolean;
  missingCaseIds: string[];
  duplicateCaseIds: string[];
  unexpectedCaseIds: string[];
  invalidCaseIds: string[];
  failedCaseIds: string[];
  reasons: string[];
}

const clean = (value: unknown, maxLength = 300): string =>
  String(value ?? "").trim().slice(0, maxLength);

function hasFiniteScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function uniqueNonEmptyStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => clean(value, 500)).filter(Boolean))];
}

export function verifyEvaluationReceipt(
  receipt: EvaluationReceipt,
  policy: EvaluationReceiptPolicy
): EvaluationReceiptVerification {
  const reasons: string[] = [];
  const candidateId = clean(policy.candidateId, 160);
  const systemVersionId = clean(policy.systemVersionId, 160);
  const candidateSourceId = clean(policy.candidateSourceId, 160);
  const caseId = clean(policy.caseId, 160);
  const fixtureId = clean(policy.fixtureId, 200);
  const recognizedSources = new Set(
    (policy.recognizedObservationSources || []).map((source) => clean(source, 160)).filter(Boolean)
  );

  if (receipt?.schemaVersion !== 1) reasons.push("schema_version_invalid");
  if (!clean(receipt?.receiptId, 200)) reasons.push("receipt_id_missing");

  if (!candidateId || clean(receipt?.candidate?.id, 160) !== candidateId) {
    reasons.push("candidate_id_mismatch");
  }
  if (!systemVersionId || clean(receipt?.candidate?.systemVersionId, 160) !== systemVersionId) {
    reasons.push("system_version_id_mismatch");
  }
  if (!candidateSourceId || clean(receipt?.candidate?.sourceId, 160) !== candidateSourceId) {
    reasons.push("candidate_source_id_mismatch");
  }

  const evaluatorId = clean(receipt?.evaluator?.id, 160);
  if (!evaluatorId) reasons.push("evaluator_id_missing");
  if (!clean(receipt?.evaluator?.version, 160)) reasons.push("evaluator_version_missing");
  if (evaluatorId && candidateSourceId && evaluatorId === candidateSourceId) {
    reasons.push("evaluator_not_independent");
  }

  const observationSource = clean(receipt?.evaluator?.observationSource, 160);
  if (!observationSource || !recognizedSources.has(observationSource)) {
    reasons.push("observation_source_unrecognized");
  }

  if (!caseId || clean(receipt?.evaluation?.caseId, 160) !== caseId) {
    reasons.push("evaluation_case_id_mismatch");
  }
  if (!Number.isInteger(receipt?.evaluation?.caseVersion)
    || receipt.evaluation.caseVersion !== policy.caseVersion) {
    reasons.push("evaluation_case_version_mismatch");
  }
  if (!fixtureId || clean(receipt?.evaluation?.fixtureId, 200) !== fixtureId) {
    reasons.push("fixture_id_mismatch");
  }
  if (!hasFiniteScore(receipt?.evaluation?.minimumScore)
    || receipt.evaluation.minimumScore !== policy.minimumScore) {
    reasons.push("minimum_score_mismatch");
  }

  if (!hasFiniteScore(receipt?.result?.score)) reasons.push("score_invalid");
  if (receipt?.result?.candidateClaimUsedForScoring !== false) {
    reasons.push("candidate_claim_scoring_not_excluded");
  }

  const criticalCategories = uniqueNonEmptyStrings(receipt?.result?.criticalRegressionCategories);
  if (receipt?.result?.criticalRegression === true && criticalCategories.length === 0) {
    reasons.push("critical_regression_categories_missing");
  }
  if (receipt?.result?.criticalRegression !== true && criticalCategories.length > 0) {
    reasons.push("critical_regression_categories_inconsistent");
  }
  if (receipt?.result?.passed === true && receipt?.result?.criticalRegression === true) {
    reasons.push("pass_with_critical_regression");
  }
  if (receipt?.result?.passed === true
    && hasFiniteScore(receipt?.result?.score)
    && receipt.result.score < policy.minimumScore) {
    reasons.push("pass_below_minimum_score");
  }

  const evidenceRefs = uniqueNonEmptyStrings(receipt?.evidenceRefs);
  if (evidenceRefs.length === 0) reasons.push("evidence_refs_missing");

  const observedAt = clean(receipt?.observedAt, 100);
  if (!observedAt || !Number.isFinite(Date.parse(observedAt))) {
    reasons.push("observed_at_invalid");
  }

  const valid = reasons.length === 0;
  const approvalEligible = valid
    && receipt.result.passed === true
    && receipt.result.criticalRegression === false
    && receipt.result.score >= policy.minimumScore;

  return { valid, approvalEligible, reasons };
}

export function verifyEvaluationReceiptBundle(
  receipts: readonly EvaluationReceipt[],
  policy: EvaluationReceiptBundlePolicy
): EvaluationReceiptBundleVerification {
  const rows = Array.isArray(receipts) ? [...receipts] : [];
  const required = [...(policy.requiredCases || [])];
  const requiredByCase = new Map(required.map((item) => [item.caseId, item]));
  const counts = new Map<string, number>();

  for (const receipt of rows) {
    const caseId = clean(receipt?.evaluation?.caseId, 160);
    counts.set(caseId, (counts.get(caseId) || 0) + 1);
  }

  const missingCaseIds = required
    .map((item) => item.caseId)
    .filter((caseId) => !counts.has(caseId));
  const duplicateCaseIds = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([caseId]) => caseId);
  const unexpectedCaseIds = [...counts.keys()].filter((caseId) => !requiredByCase.has(caseId));
  const invalidCaseIds: string[] = [];
  const failedCaseIds: string[] = [];
  const reasons: string[] = [];

  for (const receipt of rows) {
    const caseId = clean(receipt?.evaluation?.caseId, 160);
    const requiredCase = requiredByCase.get(caseId);
    if (!requiredCase) continue;

    const verification = verifyEvaluationReceipt(receipt, {
      candidateId: policy.candidateId,
      systemVersionId: policy.systemVersionId,
      candidateSourceId: policy.candidateSourceId,
      caseId: requiredCase.caseId,
      caseVersion: requiredCase.caseVersion,
      fixtureId: requiredCase.fixtureId,
      minimumScore: requiredCase.minimumScore,
      recognizedObservationSources: policy.recognizedObservationSources
    });

    if (!verification.valid) {
      invalidCaseIds.push(caseId);
      reasons.push(...verification.reasons.map((reason) => `${caseId}:${reason}`));
    } else if (!verification.approvalEligible) {
      failedCaseIds.push(caseId);
    }
  }

  const complete = missingCaseIds.length === 0
    && duplicateCaseIds.length === 0
    && unexpectedCaseIds.length === 0
    && rows.length === required.length;

  const valid = complete && invalidCaseIds.length === 0;
  const approvalEligible = valid && failedCaseIds.length === 0;

  return {
    complete,
    valid,
    approvalEligible,
    missingCaseIds,
    duplicateCaseIds,
    unexpectedCaseIds,
    invalidCaseIds,
    failedCaseIds,
    reasons
  };
}
