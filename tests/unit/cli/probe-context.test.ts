/**
 * MS-7 S3 unit tests: the CLI probe seam (ruling R6). The CapabilityContext
 * fed to route and the workflow commands must come from the adapter probe —
 * today the values equal GENERIC_BASELINE by construction; what is pinned
 * here is provenance, host identity, and per-call freshness.
 */
import { describe, expect, it } from 'vitest';
import { GENERIC_ADAPTER_NAME, probeCapabilities } from '../../../src/adapters/index.js';
import { GENERIC_BASELINE } from '../../../src/core/router/index.js';
import { probeContext } from '../../../src/cli/probe-context.js';

describe('probeContext (MS-7 S3)', () => {
  it('names the generic adapter as the host source (AC-3)', () => {
    expect(probeContext().host).toBe(GENERIC_ADAPTER_NAME);
  });

  it('carries exactly the probed set — and R6 holds: it equals the floor', () => {
    const probed = [...probeCapabilities()].sort();
    expect([...probeContext().capabilities].sort()).toEqual(probed);
    expect(probed).toEqual([...GENERIC_BASELINE].sort());
  });

  it('hands out a fresh set per call — a caller cannot poison routing', () => {
    const leaked = probeContext();
    (leaked.capabilities as Set<string>).delete('shell.execute');
    expect([...probeContext().capabilities].sort()).toEqual(
      [...probeCapabilities()].sort(),
    );
  });
});
