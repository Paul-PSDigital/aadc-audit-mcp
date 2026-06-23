// Tests for the hardcoded-url audit (Standards 4, 6).
//
// Covers the post-web-extension behaviour: Dart and web source are both
// scanned, an external https literal in code FAILS, a config-reference
// URL does NOT, and a project with no source is applicable:false.

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditHardcodedUrl } from '../src/audits/hardcoded-url.js';
import { fixture } from './helpers/fixtures.js';

test('web-bad-vanilla-pwa: flags hardcoded URLs in web source', async () => {
  const r = await auditHardcodedUrl({ projectRoot: fixture('web-bad-vanilla-pwa') });
  assert.equal(r.severity, 'fail');
  assert.notEqual(r.applicable, false);
  assert.ok(r.findings.length >= 2, `expected >=2 findings, got ${r.findings.length}`);
  assert.ok(typeof r.scanned === 'number' && r.scanned >= 1);
  // At least one finding is in app.js and names the hardcoded URL.
  assert.ok(r.findings.some((f) => f.where.includes('app.js')));
  assert.ok(r.findings.some((f) => f.message.includes('Hardcoded URL')));
});

test('web-good-clean-pwa: config-reference URL is NOT flagged', async () => {
  const r = await auditHardcodedUrl({ projectRoot: fixture('web-good-clean-pwa') });
  assert.equal(r.severity, 'pass');
  assert.notEqual(r.applicable, false);
  assert.equal(r.findings.length, 0);
});

test('flutter-nonstandard-layout: flags setUrl + launchUrl literals off apps/mobile', async () => {
  const r = await auditHardcodedUrl({ projectRoot: fixture('flutter-nonstandard-layout') });
  assert.equal(r.severity, 'fail');
  assert.equal(r.findings.length, 2);
  // Layout-agnostic: findings cite packages/player, not apps/mobile.
  for (const f of r.findings) {
    assert.ok(f.where.startsWith('packages/player/'), `unexpected where: ${f.where}`);
    assert.ok(f.message.includes('Hardcoded URL'));
  }
});

test('empty-no-stack: applicable:false with scanned 0 when no source', async () => {
  const r = await auditHardcodedUrl({ projectRoot: fixture('empty-no-stack') });
  assert.equal(r.applicable, false);
  assert.equal(r.severity, 'pass');
  assert.equal(r.scanned, 0);
  assert.equal(r.findings.length, 0);
});

test('hardcoded-url-regex: regex-literal awareness (FIX 3)', async () => {
  const r = await auditHardcodedUrl({ projectRoot: fixture('hardcoded-url-regex') });
  // (a) real URL after a /^https?:\/\// regex still flags.
  assert.ok(
    r.findings.some((f) => f.message.includes('real-track.example.com')),
    'real URL after url-matching regex must be flagged',
  );
  // (c) real URL after a division operator still flags.
  assert.ok(
    r.findings.some((f) => f.message.includes('real.example.com')),
    'real URL after a division operator must be flagged',
  );
  // (b) URL inside a // comment following a /it\'s/ regex must NOT flag.
  assert.ok(
    !r.findings.some((f) => f.message.includes('docs.example.com')),
    'URL inside a trailing // comment must not be flagged',
  );
});

test('hardcoded-url-schemaorg: JSON-LD @context schema.org is exempt (FIX 8)', async () => {
  const r = await auditHardcodedUrl({ projectRoot: fixture('hardcoded-url-schemaorg') });
  assert.equal(r.severity, 'pass');
  assert.notEqual(r.applicable, false);
  assert.ok(
    !r.findings.some((f) => f.message.includes('schema.org')),
    'https://schema.org @context must not be flagged',
  );
  assert.equal(r.findings.length, 0);
});
