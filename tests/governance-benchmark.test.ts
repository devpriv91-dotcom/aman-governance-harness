import assert from "node:assert/strict";
import test from "node:test";
import {
  governanceBenchmarkCatalog,
  GOVERNANCE_BENCHMARK_VERSION,
  runGovernanceBenchmark
} from "../src/index.ts";

test("governance benchmark exposes 50 unique documented scenarios", () => {
  const catalog = governanceBenchmarkCatalog();
  assert.equal(catalog.length, 50);
  assert.equal(new Set(catalog.map((scenario) => scenario.id)).size, 50);
  assert.equal(catalog.filter((scenario) => scenario.category === "authority").length, 20);
  assert.equal(catalog.filter((scenario) => scenario.category === "input-safety").length, 10);
  assert.equal(catalog.filter((scenario) => scenario.category === "provider-boundary").length, 10);
  assert.equal(catalog.filter((scenario) => scenario.category === "evidence-replay").length, 10);
});

test("governance benchmark produces a machine-readable passing report", async () => {
  const report = await runGovernanceBenchmark();
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.benchmarkVersion, GOVERNANCE_BENCHMARK_VERSION);
  assert.equal(report.scenarioCount, 50);
  assert.equal(report.results.length, 50);
  assert.equal(report.criticalRegressions.length, 0);
  assert.equal(report.passed, true);
  assert.equal(report.categoryTotals.authority.total, 20);
  assert.equal(report.categoryTotals["input-safety"].total, 10);
  assert.equal(report.categoryTotals["provider-boundary"].total, 10);
  assert.equal(report.categoryTotals["evidence-replay"].total, 10);
  assert.equal(report.results.every((result) => result.passed), true);
  assert.equal(Number.isFinite(Date.parse(report.generatedAt)), true);
});
