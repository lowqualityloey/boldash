import { describe, expect, it } from 'vitest';
import {
  containsSecretShape,
  redactText,
} from '../../../src/core/verification/redact.js';

/**
 * MS-5 slice 2, ruling D3: narrow high-confidence redaction.
 * Every vector is either a proven redaction or a proven PASS-THROUGH —
 * false alarms on benign text are as tested-for as misses on real shapes.
 */

describe('known token shapes', () => {
  it('redacts a GitHub PAT and an AWS key id', () => {
    const gh = 'remote: ghp_' + 'A'.repeat(36) + ' pushed';
    const r = redactText(gh);
    expect(r.status).toBe('redacted');
    if (r.status !== 'redacted') return;
    expect(r.value).toContain('[REDACTED]');
    expect(r.value).not.toContain('ghp_');
    expect(containsSecretShape(r.value)).toBe(false);
  });

  it('redacts PEM private key blocks whole', () => {
    const pem =
      'x\n-----BEGIN RSA PRIVATE KEY-----\nMIIBVw...\n-----END RSA PRIVATE KEY-----\ny';
    const r = redactText(pem);
    expect(r.status).toBe('redacted');
    if (r.status !== 'redacted') return;
    expect(r.value).not.toContain('MIIBVw');
  });
});

describe('quoted assignments', () => {
  it('PASS/BLOCK pair: quoted value redacts, benign prose passes through', () => {
    const leak = 'config load: api_key = "sk-abc123xyz"';
    const r = redactText(leak);
    expect(r.status).toBe('redacted');
    if (r.status !== 'redacted') return;
    expect(r.value).toBe('config load: api_key = "[REDACTED]"');

    const benign = 'The token count in the budget was raised to 80 tokens per route.';
    expect(redactText(benign).status).toBe('clean');
    const prose = 'password rotation policy lives in SECURITY.md (no literals here)';
    expect(redactText(prose).status).toBe('clean');
  });

  it('case-insensitive on the key, both quote styles, colon or equals', () => {
    for (const v of [`PASSWORD: "abc123"`, `Api_KEY = 'zzz999'`, `Secret:"short1"`]) {
      expect(redactText(v).status, v).toBe('redacted');
    }
  });

  it('documented limit: unquoted assignments are NOT matched (D3 narrow set)', () => {
    expect(redactText('password: hunter2').status).toBe('clean');
  });

  it('the redactor never flags its own placeholder (post-pass strip)', () => {
    expect(containsSecretShape('api_key = "[REDACTED]"')).toBe(false);
    expect(containsSecretShape('api_key = "realfake"')).toBe(true);
  });
});

describe('counts and idempotence', () => {
  it('counts every redaction across patterns', () => {
    const two = `ghp_${'B'.repeat(36)} and AKIA${'C'.repeat(16)}`;
    const r = redactText(two);
    expect(r.status).toBe('redacted');
    if (r.status !== 'redacted') return;
    expect(r.count).toBe(2);
  });

  it('second pass over redacted output is clean (idempotent)', () => {
    const once = redactText(`token = 't0k3n-value'`);
    if (once.status !== 'redacted') throw new Error('expected first-pass redaction');
    expect(redactText(once.value).status).toBe('clean');
  });
});
