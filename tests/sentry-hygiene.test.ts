// Tests for the sentry-hygiene audit (Standards 7, 9).
//
// A Sentry dependency (sentry_flutter or @sentry/*) makes the audit
// applicable; missing init hygiene fails; no Sentry dep at all makes it
// applicable:false (the dual contract).

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditSentryHygiene } from '../src/audits/sentry-hygiene.js';
import { fixture } from './helpers/fixtures.js';

test('sentry-npm-undisclosed: @sentry/* dep present, JS init sets sendDefaultPii:true => applicable fail', async () => {
  const r = await auditSentryHygiene({ projectRoot: fixture('sentry-npm-undisclosed') });
  // Applicable means applicable:false is NOT set (the flag is omitted when
  // the audit had relevant inputs).
  assert.notEqual(r.applicable, false);
  assert.equal(r.severity, 'fail');
  assert.ok(r.findings.length >= 1);
  assert.ok(typeof r.scanned === 'number' && r.scanned >= 1);
  // The JS Sentry.init is found; the failure names a real hygiene
  // problem (sendDefaultPii), not "no init".
  assert.ok(r.findings.some((f) => f.message.includes('sendDefaultPii')));
  assert.ok(!r.findings.some((f) => f.message.includes('no SentryFlutter.init')));
});

test('flutter-nonstandard-layout: sentry_flutter dep, no init => fail off apps/mobile', async () => {
  const r = await auditSentryHygiene({ projectRoot: fixture('flutter-nonstandard-layout') });
  assert.notEqual(r.applicable, false);
  assert.equal(r.severity, 'fail');
  assert.equal(r.findings.length, 1);
});

test('empty-no-stack: no Sentry dep => applicable:false, scanned 0', async () => {
  const r = await auditSentryHygiene({ projectRoot: fixture('empty-no-stack') });
  assert.equal(r.applicable, false);
  assert.equal(r.severity, 'pass');
  assert.equal(r.scanned, 0);
  assert.equal(r.findings.length, 0);
});

test('sentry-clean-npm: clean JS Sentry.init (PII off, no replay) => pass (FIX 4)', async () => {
  const r = await auditSentryHygiene({ projectRoot: fixture('sentry-clean-npm') });
  assert.notEqual(r.applicable, false);
  assert.equal(r.severity, 'pass');
  assert.equal(r.findings.length, 0);
  // The JS init was found, so the "no init" finding is never emitted.
  assert.ok(!r.summary.includes('no'));
});
