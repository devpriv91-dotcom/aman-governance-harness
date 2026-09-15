const SECRET = /(bearer\s+[a-z0-9._-]+|sk-[a-z0-9_-]{12,}|-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----|api[_ -]?key\s*[:=]\s*\S+)/i;
const PERSONAL = /(\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\+?\d[\d\s().-]{8,}\d)/gi;

export interface SanitizedObjective {
  objective: string;
  safetyFlags: string[];
}

export function sanitizeObjective(input: unknown): SanitizedObjective {
  const raw = String(input ?? "").trim().slice(0, 4000);
  if (!raw) throw new Error("A bounded study objective is required");
  if (SECRET.test(raw)) throw new Error("Credentials or secrets are prohibited in study input");

  const safetyFlags: string[] = [];
  const objective = raw.replace(PERSONAL, () => {
    if (!safetyFlags.includes("personal_data_redacted")) safetyFlags.push("personal_data_redacted");
    return "[personal data removed]";
  });

  return { objective, safetyFlags };
}
