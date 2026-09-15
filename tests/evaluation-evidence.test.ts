import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AMAN_HARNESS_VERSION,
  buildOpenAIEvaluationEvidence,
  type ProviderEvaluationReport
} from "../src/index.ts";

const passingReport: ProviderEvaluationReport = {
  provider: "openai:gpt-example",
  passed: true,
  criticalRegressions: [],
  results: [
    {
      id: "provider.validation-only",
      title: "bounded validation",
      severity: "critical",
      passed: true,
      detail: "completed"
    },
    {
      id: "provider.authority-escalation",
      title: "self authorization denied",
      severity: "critical",
      passed: true,
      detail: "denied"
    }
  ]
};

test("OpenAI evaluation evidence records exact model, release context, and case counts", () => {
  const evidence = buildOpenAIEvaluationEvidence({
    model: "gpt-example-2026-09-12",
    report: passingReport,
    releaseTag: "v0.1.0-alpha.1",
    commitSha: "0123456789abcdef",
    generatedAt: "2026-09-12T12:00:00Z"
  });

  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.generatedAt, "2026-09-12T12:00:00Z");
  assert.equal(evidence.harnessVersion, AMAN_HARNESS_VERSION);
  assert.equal(evidence.release.tag, "v0.1.0-alpha.1");
  assert.equal(evidence.release.commitSha, "0123456789abcdef");
  assert.equal(evidence.provider.vendor, "OpenAI");
  assert.equal(evidence.provider.name, "openai:gpt-example");
  assert.equal(evidence.provider.model, "gpt-example-2026-09-12");
  assert.equal(evidence.provider.liveProviderCallCount, 2);
  assert.equal(evidence.provider.evaluationCaseCount, 2);
  assert.equal(evidence.result.passed, true);
  assert.equal(evidence.result.failedCaseCount, 0);
  assert.deepEqual(evidence.result.criticalRegressions, []);
});

test("OpenAI evaluation evidence preserves failures rather than normalizing them", () => {
  const failingReport: ProviderEvaluationReport = {
    ...passingReport,
    passed: false,
    criticalRegressions: ["provider.validation-only"],
    results: passingReport.results.map((result, index) => index === 0 ? { ...result, passed: false, detail: "provider unavailable" } : result)
  };

  const evidence = buildOpenAIEvaluationEvidence({
    model: "gpt-example",
    report: failingReport,
    generatedAt: "2026-09-12T12:00:00Z"
  });

  assert.equal(evidence.result.passed, false);
  assert.equal(evidence.result.failedCaseCount, 1);
  assert.deepEqual(evidence.result.criticalRegressions, ["provider.validation-only"]);
});

test("source version remains synchronized with package version", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
  assert.equal(packageJson.version, AMAN_HARNESS_VERSION);
});
