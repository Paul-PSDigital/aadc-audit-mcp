// Tests for the sdks audit (Standards 5, 9, 12, 13).
//
// Flags dependencies outside the per-language allowlist, confirms an
// allowlisted Flutter stack passes off apps/mobile, and returns
// applicable:false when no dependency manifest is present.

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditSdks } from '../src/audits/sdks.js';
import { fixture } from './helpers/fixtures.js';

test('web-bad-vanilla-pwa: @sentry/browser is off the npm allowlist', async () => {
  const r = await auditSdks({ projectRoot: fixture('web-bad-vanilla-pwa') });
  assert.equal(r.severity, 'fail');
  assert.notEqual(r.applicable, false);
  assert.ok(typeof r.scanned === 'number' && r.scanned >= 1);
  assert.ok(r.findings.some((f) => f.where.includes('package.json')));
});

test('web-good-clean-pwa: react is allowlisted', async () => {
  const r = await auditSdks({ projectRoot: fixture('web-good-clean-pwa') });
  assert.equal(r.severity, 'pass');
  assert.notEqual(r.applicable, false);
  assert.equal(r.findings.length, 0);
});

test('flutter-nonstandard-layout: just_audio + sentry_flutter on flutter allowlist', async () => {
  const r = await auditSdks({ projectRoot: fixture('flutter-nonstandard-layout') });
  assert.equal(r.severity, 'pass');
  assert.notEqual(r.applicable, false);
  assert.equal(r.findings.length, 0);
});

test('empty-no-stack: applicable:false with scanned 0 when no manifests', async () => {
  const r = await auditSdks({ projectRoot: fixture('empty-no-stack') });
  assert.equal(r.applicable, false);
  assert.equal(r.severity, 'pass');
  assert.equal(r.scanned, 0);
  assert.equal(r.findings.length, 0);
});

test('sdks-expanded-form: expanded-form mixpanel_flutter hard-block fires (FIX 6)', async () => {
  const r = await auditSdks({ projectRoot: fixture('sdks-expanded-form') });
  assert.equal(r.severity, 'fail');
  assert.notEqual(r.applicable, false);
  // The bare-colon expanded form is now extracted and hard-blocked.
  assert.ok(
    r.findings.some(
      (f) => f.message.includes('mixpanel_flutter') && f.message.includes('HARD-BLOCKED'),
    ),
    'expanded-form mixpanel_flutter must be hard-blocked',
  );
  // The 4-space-indented sub-keys (hosted:, version:) are NOT captured
  // as dependencies.
  assert.ok(!r.findings.some((f) => f.message.includes(': hosted')));
  assert.ok(!r.findings.some((f) => f.message.includes(': version')));
});
