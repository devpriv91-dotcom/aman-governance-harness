import { createHash } from "node:crypto";
import type { RequestedAction } from "./types.ts";

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Deterministic JSON encoding for integrity bindings.
 * Unsupported or ambiguous values fail closed instead of being coerced.
 */
export function canonicalJson(value: unknown, seen = new Set<object>()): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new TypeError("non-finite numbers are not canonical JSON");
      return JSON.stringify(value);
    case "undefined":
    case "bigint":
    case "function":
    case "symbol":
      throw new TypeError(`unsupported canonical JSON value: ${typeof value}`);
    case "object":
      break;
  }

  const object = value as object;
  if (seen.has(object)) throw new TypeError("cyclic values are not canonical JSON");
  seen.add(object);

  try {
    if (Array.isArray(value)) {
      const parts: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new TypeError("sparse arrays are not canonical JSON");
        }
        parts.push(canonicalJson(value[index], seen));
      }
      return `[${parts.join(",")}]`;
    }

    if (!isPlainObject(object)) throw new TypeError("only plain objects are canonical JSON");
    if (Object.getOwnPropertySymbols(object).length) {
      throw new TypeError("symbol-keyed properties are not canonical JSON");
    }

    const record = value as Record<string, unknown>;
    const descriptors = Object.getOwnPropertyDescriptors(record);
    const keys = Object.keys(record).sort();
    const parts: string[] = [];

    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || descriptor.get || descriptor.set) {
        throw new TypeError("accessor properties are not canonical JSON");
      }
      parts.push(`${JSON.stringify(key)}:${canonicalJson(record[key], seen)}`);
    }

    return `{${parts.join(",")}}`;
  } finally {
    seen.delete(object);
  }
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Binds approval to the complete execution intent rather than only action/target.
 * Any change to action, target, summary, or parameters produces a different digest.
 */
export function fingerprintRequest(request: RequestedAction): string {
  return sha256Hex(canonicalJson({
    version: 1,
    action: request.action,
    target: request.target,
    summary: request.summary ?? null,
    parameters: request.parameters ?? null
  }));
}
