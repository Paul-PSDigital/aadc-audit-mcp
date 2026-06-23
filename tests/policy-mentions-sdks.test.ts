// Tests for the policy-mentions-sdks audit (Standards 4, 9).
//
// Cross-references external-service SDKs (Flutter / npm / Python) found
// across all dependency manifests against the privacy policy. Walks
// every pubspec.yaml / package.json / requirements*.txt, strips version
// specifiers, matches npm case-insensitively, and converts the
// no-policy / no-manifest cases to applicable:false.

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditPolicyMentionsSdks } from '../src/audits/policy-mentions-sdks.js';
import { fixture } from './helpers/fixtures.js';

test('sentry-npm-undisclosed: undisclosed Sentry npm dep fails, message names Sentry', async () => {
  const r = await auditPolicyMentionsSdks({ projectRoot: fixture('sentry-npm-undisclosed') });
  assert.equal(r.severity, 'fail');
  assert.notEqual(r.applicable, false);
  assert.ok(typeof r.scanned === 'number' && r.scanned >= 1);
  assert.ok(r.findings.some((f) => f.message.includes('Sentry')));
});

test('policy-walks-all-pubspecs: monorepo with two pubspecs, both SDKs flagged', async () => {
  const r = await auditPolicyMentionsSdks({ projectRoot: fixture('policy-walks-all-pubspecs') });
  assert.equal(r.severity, 'fail');
  assert.notEqual(r.applicable, false);
  // One finding per undisclosed external-service SDK across both pubspecs.
  assert.ok(r.findings.length >= 2, `expected >=2 findings, got ${r.findings.length}`);
});

test('policy-npm-web: PostHog disclosed, Sentry undisclosed => 1 finding', async () => {
  const r = await auditPolicyMentionsSdks({ projectRoot: fixture('policy-npm-web') });
  assert.equal(r.severity, 'fail');
  assert.equal(r.findings.length, 1);
  assert.ok(r.findings[0].message.includes('Sentry'));
});

test('policy-python-requirements: version specifiers stripped, 2 findings', async () => {
  const r = await auditPolicyMentionsSdks({ projectRoot: fixture('policy-python-requirements') });
  assert.equal(r.severity, 'fail');
  assert.equal(r.findings.length, 2);
});

test('policy-all-disclosed: every external-service SDK named => pass, 0 findings', async () => {
  const r = await auditPolicyMentionsSdks({ projectRoot: fixture('policy-all-disclosed') });
  assert.equal(r.severity, 'pass');
  assert.notEqual(r.applicable, false);
  assert.equal(r.findings.length, 0);
});

test('empty-no-stack: applicable:false with scanned 0 when no policy', async () => {
  const r = await auditPolicyMentionsSdks({ projectRoot: fixture('empty-no-stack') });
  assert.equal(r.applicable, false);
  assert.equal(r.severity, 'pass');
  assert.equal(r.scanned, 0);
  assert.equal(r.findings.length, 0);
});
