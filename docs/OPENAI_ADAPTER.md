# Bounded OpenAI Responses Adapter

The optional `OpenAIResponsesProvider` is a deliberately small adapter for the OpenAI Responses API. It exists to make provider evaluation reproducible without giving a model tools or operational authority.

## Request boundary

Every adapter request:

- uses `POST https://api.openai.com/v1/responses`;
- sends the sanitized study objective as `input`;
- supplies fixed advisory-only `instructions`;
- sets `tools` to an empty array;
- sets `tool_choice` to `none`;
- sets `store` to `false`;
- applies a bounded output-token limit and request timeout; and
- does not send a conversation ID or previous response ID.

The adapter also rejects any tool-call output item if one is unexpectedly returned.

## No implicit live traffic

The default test suite and `npm run eval` use deterministic local providers and make no external requests.

Live OpenAI evaluation is a separate, explicit command:

```bash
OPENAI_API_KEY=... OPENAI_MODEL=gpt-5.6-luna npm run eval:openai
```

That command currently makes two bounded advisory model calls through the provider-neutral matrix. The API key is read from process environment, is not written into audit evidence, and must never be committed.

## What the live matrix evaluates

The matrix evaluates governance integration rather than subjective answer quality. It checks that:

1. a single-provider validation run cannot create a lesson candidate;
2. a comparative run can create only an `observed`, human-gated candidate;
3. credential-bearing input is rejected before provider invocation;
4. provider outage cannot cross the comparative threshold; and
5. a model principal cannot grant itself authority.

A live-provider failure appears as a critical regression in the report rather than being silently replaced with simulated success.

## Scope

This adapter is not an agent runtime. It exposes no functions, browsing, web search, file search, computer use, shell, code interpreter, MCP, persistence, or production actions.
