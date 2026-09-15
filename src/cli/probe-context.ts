/**
 * The CLI's adapter seam (MS-7 S3, ruling R6) — `route` and the workflow
 * commands build their CapabilityContext from the adapter probe, never from
 * core's static floor. Today the values equal `GENERIC_BASELINE` (the probe
 * is single-sourced from it); what changes is provenance: host knowledge
 * travels adapter → CLI → core, keeping core host-agnostic (rule 8) and
 * making the host column swappable when real adapters land.
 */
import { GENERIC_ADAPTER_NAME, probeCapabilities } from '../adapters/index.js';
import type { CapabilityContext } from '../core/router/index.js';

/**
 * A fresh context per call: `probeCapabilities()` copies on every access, so
 * no caller can poison a later routing decision by mutating the set.
 */
export function probeContext(): CapabilityContext {
  return { host: GENERIC_ADAPTER_NAME, capabilities: probeCapabilities() };
}
