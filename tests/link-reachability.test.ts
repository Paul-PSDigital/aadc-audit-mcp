// Tests for the link-reachability audit (Standards 4, 6).
//
// This audit is opt-in because it makes outbound HTTP requests. The
// offline suite exercises ONLY the default (disabled) path, which is
// applicable:false. The network-enabled path is intentionally excluded
// from CI so the suite stays deterministic and offline.

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditLinkReachability } from '../src/audits/link-reachability.js';
import { fixture } from './helpers/fixtures.js';

test('link-reachability-content: default (disabled) => applicable:false, names AADC_CHECK_LINKS', async () => {
  // No checkLinks option and AADC_CHECK_LINKS unset, so this stays offline.
  const r = await auditLinkReachability({ projectRoot: fixture('link-reachability-content') });
  assert.equal(r.applicable, false);
  // applicable:false must pair with a non-fail severity (the contract).
  assert.notEqual(r.severity, 'fail');
  assert.equal(r.severity, 'pass');
  assert.equal(r.scanned, 0);
  assert.equal(r.findings.length, 0);
  assert.ok(r.summary.includes('AADC_CHECK_LINKS'));
});
