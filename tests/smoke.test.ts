import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/version.js';

/**
 * Smoke test: proves the vitest runner, the ESM import graph, and the build
 * pipeline agree. Replaced by real engine suites from MS-2 onward.
 */
describe('scaffold smoke', () => {
  it('exposes the package version', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
