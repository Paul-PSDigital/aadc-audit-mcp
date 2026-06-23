// Tests for the network-isolation audit (Standard 8).
//
// Config-gated: with no protectedPaths the audit is applicable:false;
// with protectedPaths set, a forbidden network call inside a protected
// path FAILS while a pure on-device file is NOT flagged.

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditNetworkIsolation } from '../src/audits/network-isolation.js';
import { fixture } from './helpers/fixtures.js';

test('network-isolation-configured: no protectedPaths => applicable:false', async () => {
  const r = await auditNetworkIsolation({ projectRoot: fixture('network-isolation-configured') });
  assert.equal(r.applicable, false);
  assert.equal(r.severity, 'pass');
  assert.equal(r.scanned, 0);
  assert.equal(r.findings.length, 0);
  assert.ok(r.summary.includes('protectedPaths'));
});

test('network-isolation-configured: protectedPaths set => fail on engine.dart only', async () => {
  const r = await auditNetworkIsolation({
    projectRoot: fixture('network-isolation-configured'),
    options: { protectedPaths: 'lib/scoring' },
  });
  assert.notEqual(r.applicable, false);
  assert.equal(r.severity, 'fail');
  assert.equal(r.findings.length, 1);
  assert.ok(r.findings[0].where.includes('engine.dart'));
  // Pure on-device code is never flagged (false-positive guard).
  assert.ok(!r.findings.some((f) => f.where.includes('clean_engine.dart')));
});

test('network-isolation: declared protected path not found on disk => warn (FIX 9)', async () => {
  const r = await auditNetworkIsolation({
    projectRoot: fixture('network-isolation-configured'),
    options: { protectedPaths: 'lib/does-not-exist' },
  });
  // Declared but zero readable files: warn, applicable (not false), not a
  // green "confirmed network-free" pass.
  assert.notEqual(r.applicable, false);
  assert.equal(r.severity, 'warn');
  assert.equal(r.scanned, 0);
  assert.equal(r.findings.length, 0);
  assert.ok(r.summary.toLowerCase().includes('not found'), `summary: ${r.summary}`);
});
