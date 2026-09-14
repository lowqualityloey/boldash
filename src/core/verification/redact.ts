/**
 * Best-effort secret redaction for evidence payloads (ruling D3).
 *
 * Scope is deliberately NARROW and high-confidence:
 * - known token shapes (GitHub, AWS) — unambiguous by prefix;
 * - PEM private-key blocks — unambiguous by header;
 * - `key: "value"` / `key = 'value'` assignments for password|secret|token|
 *   api[_-]?key — quoted values only.
 *
 * Two acknowledged limits, stated rather than hidden:
 * 1. unquoted assignments (`password: hunter2`) are NOT matched — matching bare
 *    words produced so many false alarms in the broad-net experiment (issue
 *    #12 discussion) that users would have learned to route around the gate,
 *    which is worse than the leak class it prevents;
 * 2. this is redaction, not detection: it guards the common accident, not a
 *    determined exfiltration. SECURITY.md keeps review-before-commit as the
 *    human layer.
 *
 * Failure contract: if a match exists but replacement cannot be produced
 * safely, the caller MUST NOT write raw output — it surfaces
 * EVIDENCE_REDACTION_FAILED (exit 10) instead. Clean-or-fail, never raw.
 */

export type RedactResult =
  | { status: 'clean'; value: string }
  | { status: 'redacted'; value: string; count: number }
  | { status: 'failed'; reason: string };

/** Single source for the pattern set, reused by the evidence store's defense-in-depth scan. */
const SECRET_PATTERNS: ReadonlyArray<{ re: RegExp; keep: string }> = [
  { re: /ghp_[A-Za-z0-9]{36}/g, keep: '' },
  { re: /github_pat_[A-Za-z0-9_]{22,}/g, keep: '' },
  { re: /AKIA[0-9A-Z]{16}/g, keep: '' },
  {
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    keep: '',
  },
  {
    // Group 4 holds the value so the placeholder `[REDACTED]` can be excluded
    // by lookahead — without it, redaction is not idempotent (a second pass
    // redacts its own output). `+` because an empty quoted value is no secret.
    re: /\b(password|secret|token|api[_-]?key)\b(\s*[:=]\s*)(['"])((?!\[REDACTED])[^'"\r\n]+)\3/gi,
    keep: '$1$2$3[REDACTED]$3',
  },
];

const REPLACER = '[REDACTED]';

/** Strip this module's placeholder so it can never be mistaken for a secret. */
function unredactedView(text: string): string {
  return text.split(REPLACER).join('');
}

/** Probes the escaped form too: the evidence store calls this on SERIALIZED
 * JSON, where `\"` would otherwise hide a quoted assignment from the pattern. */
function patternHits(text: string, re: RegExp): boolean {
  re.lastIndex = 0;
  if (re.test(text)) return true;
  const unescaped = text.replace(/\\"/g, '"');
  re.lastIndex = 0;
  return unescaped !== text && re.test(unescaped);
}

/** Scan text for any secret shape; returns true when raw content must not be stored.
 * The redactor's own placeholder is stripped first — `key: "[REDACTED]"` is proof
 * of successful redaction, not a surviving secret. */
export function containsSecretShape(text: string): boolean {
  const probe = unredactedView(text);
  return SECRET_PATTERNS.some((p) => patternHits(probe, p.re));
}

export function redactText(input: string): RedactResult {
  let value = input;
  let count = 0;
  try {
    for (const { re, keep } of SECRET_PATTERNS) {
      const matches = input.match(re);
      const n = matches ? matches.length : 0;
      if (n === 0) continue;
      value = keep === '' ? value.replace(re, REPLACER) : value.replace(re, keep);
      count += n;
    }
  } catch (cause) {
    return { status: 'failed', reason: `redactor error: ${String(cause)}` };
  }
  // Post-pass: if any shape survived replacement we cannot prove safety — fail.
  if (containsSecretShape(value)) {
    return {
      status: 'failed',
      reason: 'secret-shaped content survived redaction',
    };
  }
  return count > 0 ? { status: 'redacted', value, count } : { status: 'clean', value };
}
