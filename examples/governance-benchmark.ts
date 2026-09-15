import { runGovernanceBenchmark } from "../src/index.ts";

const report = await runGovernanceBenchmark();
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
