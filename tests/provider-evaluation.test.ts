import assert from "node:assert/strict";
import test from "node:test";
import {
  OpenAIResponsesProvider,
  runProviderEvaluationMatrix
} from "../src/index.ts";

test("OpenAI adapter sends a stateless text-only Responses API request", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const provider = new OpenAIResponsesProvider({
    apiKey: "test-key-not-secret",
    model: "gpt-5.6-luna",
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify({
        status: "completed",
        output: [
          { type: "reasoning", summary: [] },
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "Bounded advisory result." }]
          }
        ]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  const text = await provider.reason("Review a synthetic recovery plan.");
  assert.equal(text, "Bounded advisory result.");
  assert.equal(capturedUrl, "https://api.openai.com/v1/responses");

  const body = JSON.parse(String(capturedInit?.body));
  assert.equal(body.store, false);
  assert.equal(body.tool_choice, "none");
  assert.deepEqual(body.tools, []);
  assert.equal(body.model, "gpt-5.6-luna");
  assert.equal(body.input, "Review a synthetic recovery plan.");
  assert.match(body.instructions, /advisory reasoning peer/);
  assert.equal("previous_response_id" in body, false);
  assert.equal("conversation" in body, false);
});

test("OpenAI adapter rejects unexpected tool-call output", async () => {
  const provider = new OpenAIResponsesProvider({
    apiKey: "test-key-not-secret",
    fetchImpl: async () => new Response(JSON.stringify({
      status: "completed",
      output: [{ type: "function_call", name: "unexpected" }]
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  });

  await assert.rejects(
    () => provider.reason("Review a synthetic recovery plan."),
    /tool-call item/
  );
});

test("OpenAI adapter fails closed without leaking its API key in HTTP errors", async () => {
  const key = "sensitive-test-key-never-print";
  const provider = new OpenAIResponsesProvider({
    apiKey: key,
    fetchImpl: async () => new Response("unauthorized", { status: 401 })
  });

  await assert.rejects(
    () => provider.reason("Review a synthetic recovery plan."),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /HTTP 401/);
      assert.equal(message.includes(key), false);
      return true;
    }
  );
});

test("provider-neutral evaluation matrix passes with a deterministic advisory provider", async () => {
  let calls = 0;
  const provider = {
    name: "deterministic-under-test",
    reason: async () => {
      calls += 1;
      return "Preserve evidence, state assumptions, and require human review before action.";
    }
  };

  const report = await runProviderEvaluationMatrix(provider);
  assert.equal(report.passed, true);
  assert.deepEqual(report.criticalRegressions, []);
  assert.equal(report.results.length, 5);
  assert.equal(report.results.every((result) => result.passed), true);
  assert.equal(calls, 2);
});

test("evaluation matrix reports provider failure as a critical regression", async () => {
  const report = await runProviderEvaluationMatrix({
    name: "offline-under-test",
    reason: async () => { throw new Error("offline"); }
  });

  assert.equal(report.passed, false);
  assert.equal(report.criticalRegressions.includes("provider.validation-only"), true);
  assert.equal(report.criticalRegressions.includes("provider.comparative-observed-only"), true);
});
