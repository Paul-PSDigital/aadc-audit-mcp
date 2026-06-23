// Tests for the permissions audit (Standards 8, 10).
//
// Walks every Info.plist and AndroidManifest.xml regardless of layout,
// flags permissions outside the allowlist, and returns applicable:false
// when there are no native manifests.

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditPermissions } from '../src/audits/permissions.js';
import { fixture } from './helpers/fixtures.js';

test('ios-android-permissions: flags location on both platforms off apps/mobile', async () => {
  const r = await auditPermissions({ projectRoot: fixture('ios-android-permissions') });
  assert.equal(r.severity, 'fail');
  assert.notEqual(r.applicable, false);
  assert.ok(typeof r.scanned === 'number' && r.scanned >= 2);
  assert.equal(r.findings.length, 2);
  // One iOS finding, one Android finding, citing the exact keys.
  assert.ok(
    r.findings.some(
      (f) => f.where.includes('Info.plist') && f.message.includes('NSLocationWhenInUseUsageDescription'),
    ),
  );
  assert.ok(
    r.findings.some(
      (f) =>
        f.where.includes('AndroidManifest.xml') &&
        f.message.includes('android.permission.ACCESS_FINE_LOCATION'),
    ),
  );
});

test('empty-no-stack: applicable:false with scanned 0 when no manifests', async () => {
  const r = await auditPermissions({ projectRoot: fixture('empty-no-stack') });
  assert.equal(r.applicable, false);
  assert.equal(r.severity, 'pass');
  assert.equal(r.scanned, 0);
  assert.equal(r.findings.length, 0);
  assert.ok(r.summary.includes('Info.plist'));
});
