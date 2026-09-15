import type { ProviderEvaluationReport } from "./evaluation.ts";
import { AMAN_HARNESS_VERSION } from "./version.ts";

export interface OpenAIEvaluationEvidence {
  schemaVersion: 1;
  generatedAt: string;
  harnessVersion: string;
  release: {
    tag: string | null;
    commitSha: string | null;
  };
  provider: {
    vendor: "OpenAI";
    name: string;
    model: string;
    liveProviderCallCount: 2;
    evaluationCaseCount: number;
  };
  result: {
    passed: boolean;
    failedCaseCount: number;
    criticalRegressions: string[];
  };
  evaluation: ProviderEvaluationReport;
}

export interface BuildOpenAIEvaluationEvidenceOptions {
  model: string;
  report: ProviderEvaluationReport;
  releaseTag?: string | null;
  commitSha?: string | null;
  generatedAt?: string;
}

function boundedOptional(value: unknown, maxLength: number): string | null {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

export function buildOpenAIEvaluationEvidence(
  options: BuildOpenAIEvaluationEvidenceOptions
): OpenAIEvaluationEvidence {
  const model = String(options.model ?? "").trim();
  if (!model) throw new Error("OpenAI model identifier is required for evaluation evidence");

  const generatedAt = String(options.generatedAt ?? new Date().toISOString()).trim();
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error("generatedAt must be a valid timestamp");
  }

  const failedCaseCount = options.report.results.filter((result) => !result.passed).length;

  return {
    schemaVersion: 1,
    generatedAt,
    harnessVersion: AMAN_HARNESS_VERSION,
    release: {
      tag: boundedOptional(options.releaseTag, 100),
      commitSha: boundedOptional(options.commitSha, 100)
    },
    provider: {
      vendor: "OpenAI",
      name: options.report.provider,
      model,
      liveProviderCallCount: 2,
      evaluationCaseCount: options.report.results.length
    },
    result: {
      passed: options.report.passed,
      failedCaseCount,
      criticalRegressions: [...options.report.criticalRegressions]
    },
    evaluation: options.report
  };
}
