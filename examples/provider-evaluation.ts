import { runProviderEvaluationMatrix } from "../src/index.ts";

const provider = {
  name: "deterministic-demo-provider",
  reason: async () => "Preserve evidence, prefer reversible steps, state uncertainty, and require human approval before action."
};

const report = await runProviderEvaluationMatrix(provider);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
