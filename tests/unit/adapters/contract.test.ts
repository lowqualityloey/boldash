/**
 * MS-7 S1 (plan-001): the shared contract suite runs against the generic
 * adapter. Per-host adapters add their own one-line subjects in Phase 2/3.
 */
import { describe } from 'vitest';
import { genericAdapter } from '../../../src/adapters/index.js';
import { assertAdapterContract } from './contract-suite.js';

describe('adapter contract: generic', () => {
  assertAdapterContract(genericAdapter, 'generic');
});
