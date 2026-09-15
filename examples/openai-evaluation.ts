import {
  buildOpenAIEvaluationEvidence,
  OpenAIResponsesProvider,
  runProviderEvaluationMatrix
} from "../src/index.ts";

const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim();
if (!apiKey) {
  throw new Error("Set OPENAI_API_KEY before running the explicit live OpenAI evaluation");
}

const model = String(process.env.OPENAI_MODEL ?? "gpt-5.6-luna").trim();
const provider = new OpenAIResponsesProvider({ apiKey, model });

console.error(`Running bounded provider evaluation against ${provider.name}.`);
console.error("This explicit live command makes two advisory Responses API calls and provides no tools.");

const report = await runProviderEvaluationMatrix(provider);
const evidence = buildOpenAIEvaluationEvidence({
  model: provider.model,
  report,
  releaseTag: process.env.AMAN_RELEASE_TAG,
  commitSha: process.env.AMAN_RELEASE_SHA ?? process.env.GITHUB_SHA
});

console.log(JSON.stringify(evidence, null, 2));
if (!evidence.result.passed) process.exitCode = 1;
