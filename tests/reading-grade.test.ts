// Tests for the reading-grade audit (Standards 4, 11).
//
// Scores the privacy policy and every iOS Info.plist UsageDescription
// via walk() (layout-agnostic), honours the privacyPolicyPath override,
// passes plain copy, and returns applicable:false when nothing to grade.

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditReadingGrade } from '../src/audits/reading-grade.js';
import { fixture } from './helpers/fixtures.js';

test('ios-android-permissions: over-grade NSLocation rationale fails, citing a relative Info.plist path', async () => {
  const r = await auditReadingGrade({ projectRoot: fixture('ios-android-permissions') });
  assert.equal(r.severity, 'fail');
  assert.notEqual(r.applicable, false);
  assert.ok(typeof r.scanned === 'number' && r.scanned >= 1);
  const f = r.findings.find((x) => x.where.includes('Info.plist'));
  assert.ok(f, 'expected a finding citing Info.plist');
  // Relative path, not the old hardcoded apps/mobile literal.
  assert.ok(!f!.where.startsWith('apps/mobile/'), `expected relative path, got ${f!.where}`);
  assert.ok(f!.where.includes('ios/Runner/Info.plist'));
});

test('reading-grade-multi-info-plist: walk finds both plists, 2 findings', async () => {
  const r = await auditReadingGrade({ projectRoot: fixture('reading-grade-multi-info-plist') });
  assert.equal(r.severity, 'fail');
  assert.equal(r.findings.length, 2);
  assert.ok(r.findings.every((f) => f.where.includes('Info.plist')));
});

test('reading-grade-plain-passes: short plain sentences pass, applicable:true', async () => {
  const r = await auditReadingGrade({ projectRoot: fixture('reading-grade-plain-passes') });
  assert.equal(r.severity, 'pass');
  assert.notEqual(r.applicable, false);
  assert.equal(r.findings.length, 0);
});

test('reading-grade-privacy-override: custom privacyPolicyPath is honoured', async () => {
  const r = await auditReadingGrade({
    projectRoot: fixture('reading-grade-privacy-override'),
    options: { privacyPolicyPath: 'legal/privacy.md' },
  });
  assert.equal(r.severity, 'fail');
  assert.notEqual(r.applicable, false);
  assert.ok(r.findings.some((f) => f.where.includes('legal/privacy.md')));
});

test('empty-no-stack: applicable:false with scanned 0 when nothing to grade', async () => {
  const r = await auditReadingGrade({ projectRoot: fixture('empty-no-stack') });
  assert.equal(r.applicable, false);
  assert.equal(r.severity, 'pass');
  assert.equal(r.scanned, 0);
  assert.equal(r.findings.length, 0);
});
