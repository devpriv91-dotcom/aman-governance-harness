import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { canonicalJson, sha256Hex } from "./integrity.ts";
import type {
  ApprovalConsumptionReceipt,
  ApprovalConsumptionResult,
  SignedHumanApproval
} from "./types.ts";

export interface ApprovalConsumptionStore {
  consume(signedApproval: SignedHumanApproval): ApprovalConsumptionResult;
}

function nonceHash(signed: SignedHumanApproval): string {
  return sha256Hex(String(signed.approval.nonce));
}

function consumptionKey(signed: SignedHumanApproval): string {
  return sha256Hex(canonicalJson({
    version: 1,
    approvedBy: signed.approval.approvedBy,
    signingKeyId: signed.keyId,
    nonceHash: nonceHash(signed)
  }));
}

function unsignedReceipt(signed: SignedHumanApproval, consumedAt: string) {
  return {
    consumptionId: randomUUID(),
    approvalId: signed.approval.approvalId,
    approvedBy: signed.approval.approvedBy,
    signingKeyId: signed.keyId,
    requestFingerprint: signed.approval.requestFingerprint,
    nonceHash: nonceHash(signed),
    consumedAt
  };
}

function createReceipt(signed: SignedHumanApproval): ApprovalConsumptionReceipt {
  const record = unsignedReceipt(signed, new Date().toISOString());
  return {
    ...record,
    recordHash: sha256Hex(canonicalJson(record))
  };
}

export function verifyConsumptionReceipt(receipt: ApprovalConsumptionReceipt): boolean {
  const { recordHash, ...record } = receipt;
  return /^[a-f0-9]{64}$/.test(recordHash)
    && sha256Hex(canonicalJson(record)) === recordHash;
}

export class InMemoryApprovalConsumptionStore implements ApprovalConsumptionStore {
  #receipts = new Map<string, ApprovalConsumptionReceipt>();

  consume(signedApproval: SignedHumanApproval): ApprovalConsumptionResult {
    const key = consumptionKey(signedApproval);
    const existing = this.#receipts.get(key);
    if (existing) {
      return {
        consumed: false,
        replayed: true,
        reason: "signed approval nonce has already been consumed",
        existingReceipt: structuredClone(existing)
      };
    }

    const receipt = createReceipt(signedApproval);
    this.#receipts.set(key, structuredClone(receipt));
    return {
      consumed: true,
      replayed: false,
      reason: "signed approval nonce consumed",
      receipt
    };
  }
}

/**
 * Durable single-use approval store using atomic exclusive file creation.
 * Two processes sharing the same directory cannot both claim the same nonce.
 */
export class DirectoryApprovalConsumptionStore implements ApprovalConsumptionStore {
  readonly directory: string;

  constructor(directory: string) {
    this.directory = resolve(directory);
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
  }

  consume(signedApproval: SignedHumanApproval): ApprovalConsumptionResult {
    const key = consumptionKey(signedApproval);
    const path = join(this.directory, `${key}.json`);
    const receipt = createReceipt(signedApproval);

    try {
      writeFileSync(path, `${canonicalJson(receipt)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600
      });
      return {
        consumed: true,
        replayed: false,
        reason: "signed approval nonce durably consumed",
        receipt
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;

      const existing = JSON.parse(readFileSync(path, "utf8")) as ApprovalConsumptionReceipt;
      if (!verifyConsumptionReceipt(existing)) {
        throw new Error("existing approval-consumption record failed integrity verification");
      }
      return {
        consumed: false,
        replayed: true,
        reason: "signed approval nonce has already been durably consumed",
        existingReceipt: existing
      };
    }
  }
}
