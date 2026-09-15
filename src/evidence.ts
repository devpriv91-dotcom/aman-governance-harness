import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { canonicalJson, sha256Hex } from "./integrity.ts";
import type { AuditEvent, EvidenceReceipt } from "./types.ts";

export const GENESIS_HASH = "0".repeat(64);

export interface AuditLedger {
  append(event: Pick<AuditEvent, "event" | "outcome" | "details">): AuditEvent;
  list(): readonly AuditEvent[];
  verify(): boolean;
  digest(): string;
}

function hashEvent(event: Omit<AuditEvent, "eventHash">): string {
  return sha256Hex(canonicalJson(event));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

function eventWithoutHash(event: AuditEvent): Omit<AuditEvent, "eventHash"> {
  return {
    id: event.id,
    sequence: event.sequence,
    at: event.at,
    event: event.event,
    outcome: event.outcome,
    details: event.details,
    previousHash: event.previousHash
  };
}

export function receiptFor(event: AuditEvent): EvidenceReceipt {
  return {
    eventId: event.id,
    sequence: event.sequence,
    eventHash: event.eventHash,
    previousHash: event.previousHash
  };
}

export function verifyReceipt(event: AuditEvent, receipt: EvidenceReceipt): boolean {
  return event.id === receipt.eventId
    && event.sequence === receipt.sequence
    && event.eventHash === receipt.eventHash
    && event.previousHash === receipt.previousHash
    && hashEvent(eventWithoutHash(event)) === event.eventHash;
}

export function verifyAuditChain(events: readonly AuditEvent[]): boolean {
  let previousHash = GENESIS_HASH;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.sequence !== index + 1) return false;
    if (event.previousHash !== previousHash) return false;
    if (event.eventHash !== hashEvent(eventWithoutHash(event))) return false;
    previousHash = event.eventHash;
  }

  return true;
}

function buildEvent(
  sequence: number,
  previousHash: string,
  event: Pick<AuditEvent, "event" | "outcome" | "details">
): AuditEvent {
  const recordWithoutHash: Omit<AuditEvent, "eventHash"> = {
    id: randomUUID(),
    sequence,
    at: new Date().toISOString(),
    event: event.event,
    outcome: event.outcome,
    details: structuredClone(event.details),
    previousHash
  };
  return {
    ...recordWithoutHash,
    eventHash: hashEvent(recordWithoutHash)
  };
}

export class InMemoryAuditLedger implements AuditLedger {
  #events: AuditEvent[] = [];

  append(event: Pick<AuditEvent, "event" | "outcome" | "details">): AuditEvent {
    const record = buildEvent(
      this.#events.length + 1,
      this.#events.at(-1)?.eventHash ?? GENESIS_HASH,
      event
    );
    this.#events.push(deepFreeze(record));
    return structuredClone(record);
  }

  list(): readonly AuditEvent[] {
    return structuredClone(this.#events);
  }

  verify(): boolean {
    return verifyAuditChain(this.#events);
  }

  digest(): string {
    return this.#events.at(-1)?.eventHash ?? GENESIS_HASH;
  }
}

/**
 * Durable reference ledger. Each event is written to its own sequence-numbered
 * file with exclusive creation, allowing independent processes to continue one
 * hash chain without silently overwriting an existing event.
 */
export class DirectoryAuditLedger implements AuditLedger {
  readonly directory: string;

  constructor(directory: string) {
    this.directory = resolve(directory);
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    this.#readVerified();
  }

  #eventFiles(): string[] {
    return readdirSync(this.directory)
      .filter((name) => /^\d{12}\.json$/.test(name))
      .sort();
  }

  #readVerified(): AuditEvent[] {
    const events = this.#eventFiles().map((name) => {
      const parsed = JSON.parse(readFileSync(join(this.directory, name), "utf8")) as AuditEvent;
      return parsed;
    });

    if (!verifyAuditChain(events)) {
      throw new Error("durable audit ledger failed integrity verification");
    }
    return events;
  }

  append(event: Pick<AuditEvent, "event" | "outcome" | "details">): AuditEvent {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const events = this.#readVerified();
      const sequence = events.length + 1;
      const record = buildEvent(sequence, events.at(-1)?.eventHash ?? GENESIS_HASH, event);
      const path = join(this.directory, `${String(sequence).padStart(12, "0")}.json`);

      try {
        writeFileSync(path, `${canonicalJson(record)}\n`, {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600
        });
        return structuredClone(record);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
        throw error;
      }
    }

    throw new Error("durable audit ledger could not append after concurrent retries");
  }

  list(): readonly AuditEvent[] {
    return structuredClone(this.#readVerified());
  }

  verify(): boolean {
    try {
      return verifyAuditChain(this.#readVerified());
    } catch {
      return false;
    }
  }

  digest(): string {
    const events = this.#readVerified();
    return events.at(-1)?.eventHash ?? GENESIS_HASH;
  }
}
