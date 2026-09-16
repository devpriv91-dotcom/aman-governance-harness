import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyEvaluationReceipt,
  verifyEvaluationReceiptBundle,
  type EvaluationReceipt
} from "../src/evaluator-receipts.ts";

const observationSource = "aman.deterministic-observer.v1";

function receipt(overrides: Partial<EvaluationReceipt> = {}): EvaluationReceipt {
  const base: EvaluationReceipt = {
    schemaVersion: 1,
    receiptId: "receipt-001",
    candidate: {
      id: "candidate-001",
      systemVersionId: "version-001",
      sourceId: "candidate-generator"
    },
    evaluation: {
      caseId: "case-001",
      caseVersion: 3,
      fixtureId: "fixture.authority.v1",
      minimumScore: 100
    },
    evaluator: {
      id: "independent-evaluator",
      version: "1.0.0",
      observationSource
    },
    result: {
      passed: true,
      score: 100,
      criticalRegression: false,
      criticalRegressionCategories: [],
      candidateClaimUsedForScoring: false
    },
    evidenceRefs: ["audit:abc", "fixture:fixture.authority.v1"],
    observedAt: "2026-09-16T00:00:00.000Z"
  };

  return {
    ...base,
    ...overrides,
    candidate: { ...base.candidate, ...(overrides.candidate || {}) },
    evaluation: { ...base.evaluation, ...(overrides.evaluation || {}) },
    evaluator: { ...base.evaluator, ...(overrides.evaluator || {}) },
    result: { ...base.result, ...(overrides.result || {}) }
  };
}

const policy = {
  candidateId: "candidate-001",
  systemVersionId: "version-001",
  candidateSourceId: "candidate-generator",
  caseId: "case-001",
  caseVersion: 3,
  fixtureId: "fixture.authority.v1",
  minimumScore: 100,
  recognizedObservationSources: [observationSource]
} as const;

test("matching independent evaluator receipt is valid and approval-eligible", () => {
  const result = verifyEvaluationReceipt(receipt(), policy);
  assert.equal(result.valid, true);
  assert.equal(result.approvalEligible, true);
  assert.deepEqual(result.reasons, []);
});

test("candidate source cannot serve as its own evaluator", () => {
  const result = verifyEvaluationReceipt(receipt({
    evaluator: { id: "candidate-generator", version: "1.0.0", observationSource }
  }), policy);
  assert.equal(result.valid, false);
  assert.equal(result.approvalEligible, false);
  assert.ok(result.reasons.includes("evaluator_not_independent"));
});

test("candidate claims must be explicitly excluded from scoring", () => {
  const result = verifyEvaluationReceipt(receipt({
    result: {
      passed: true,
      score: 100,
      criticalRegression: false,
      criticalRegressionCategories: [],
      candidateClaimUsedForScoring: true as unknown as false
    }
  }), policy);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("candidate_claim_scoring_not_excluded"));
});

test("unrecognized observation source fails closed", () => {
  const result = verifyEvaluationReceipt(receipt({
    evaluator: { id: "independent-evaluator", version: "1.0.0", observationSource: "unknown" }
  }), policy);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("observation_source_unrecognized"));
});

test("receipt cannot simultaneously pass and report a critical regression", () => {
  const result = verifyEvaluationReceipt(receipt({
    result: {
      passed: true,
      score: 100,
      criticalRegression: true,
      criticalRegressionCategories: ["authority"],
      candidateClaimUsedForScoring: false
    }
  }), policy);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("pass_with_critical_regression"));
});

test("failed independent evidence remains valid but is not approval-eligible", () => {
  const result = verifyEvaluationReceipt(receipt({
    result: {
      passed: false,
      score: 80,
      criticalRegression: false,
      criticalRegressionCategories: [],
      candidateClaimUsedForScoring: false
    }
  }), policy);
  assert.equal(result.valid, true);
  assert.equal(result.approvalEligible, false);
});

test("receipt identity, version, and evidence references are binding", () => {
  const result = verifyEvaluationReceipt(receipt({
    candidate: {
      id: "candidate-001",
      systemVersionId: "wrong-version",
      sourceId: "candidate-generator"
    },
    evaluation: {
      caseId: "case-001",
      caseVersion: 2,
      fixtureId: "fixture.authority.v1",
      minimumScore: 100
    },
    evidenceRefs: []
  }), policy);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("system_version_id_mismatch"));
  assert.ok(result.reasons.includes("evaluation_case_version_mismatch"));
  assert.ok(result.reasons.includes("evidence_refs_missing"));
});

test("approval bundle requires exactly one valid receipt for every required case", () => {
  const second = receipt({
    receiptId: "receipt-002",
    evaluation: {
      caseId: "case-002",
      caseVersion: 1,
      fixtureId: "fixture.provider-neutrality.v1",
      minimumScore: 100
    }
  });

  const result = verifyEvaluationReceiptBundle([receipt(), second], {
    candidateId: "candidate-001",
    systemVersionId: "version-001",
    candidateSourceId: "candidate-generator",
    recognizedObservationSources: [observationSource],
    requiredCases: [
      { caseId: "case-001", caseVersion: 3, fixtureId: "fixture.authority.v1", minimumScore: 100 },
      { caseId: "case-002", caseVersion: 1, fixtureId: "fixture.provider-neutrality.v1", minimumScore: 100 }
    ]
  });

  assert.equal(result.complete, true);
  assert.equal(result.valid, true);
  assert.equal(result.approvalEligible, true);
});

test("bundle fails closed on duplicate, missing, or failed receipts", () => {
  const failedSecond = receipt({
    receiptId: "receipt-002",
    evaluation: {
      caseId: "case-002",
      caseVersion: 1,
      fixtureId: "fixture.provider-neutrality.v1",
      minimumScore: 100
    },
    result: {
      passed: false,
      score: 100,
      criticalRegression: false,
      criticalRegressionCategories: [],
      candidateClaimUsedForScoring: false
    }
  });

  const requiredCases = [
    { caseId: "case-001", caseVersion: 3, fixtureId: "fixture.authority.v1", minimumScore: 100 },
    { caseId: "case-002", caseVersion: 1, fixtureId: "fixture.provider-neutrality.v1", minimumScore: 100 }
  ];

  const failed = verifyEvaluationReceiptBundle([receipt(), failedSecond], {
    candidateId: "candidate-001",
    systemVersionId: "version-001",
    candidateSourceId: "candidate-generator",
    recognizedObservationSources: [observationSource],
    requiredCases
  });
  assert.equal(failed.complete, true);
  assert.equal(failed.valid, true);
  assert.equal(failed.approvalEligible, false);
  assert.deepEqual(failed.failedCaseIds, ["case-002"]);

  const duplicate = verifyEvaluationReceiptBundle([receipt(), receipt()], {
    candidateId: "candidate-001",
    systemVersionId: "version-001",
    candidateSourceId: "candidate-generator",
    recognizedObservationSources: [observationSource],
    requiredCases
  });
  assert.equal(duplicate.complete, false);
  assert.equal(duplicate.approvalEligible, false);
  assert.deepEqual(duplicate.missingCaseIds, ["case-002"]);
  assert.deepEqual(duplicate.duplicateCaseIds, ["case-001"]);
});
