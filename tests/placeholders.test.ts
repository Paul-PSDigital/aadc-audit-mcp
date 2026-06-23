// Tests for the placeholders audit (Standards 4, 6).
//
// Scans shipped content (.md/.json/.yaml/.js/.ts/.dart/.html/.plist/.xml)
// for placeholder markers. A TODO in a shipped privacy policy FAILS;
// clean content PASSES; on a docs-only repo it stays applicable:true.

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditPlaceholders } from '../src/audits/placeholders.js';
import { fixture } from './helpers/fixtures.js';

test('web-bad-vanilla-pwa: TODO in shipped privacy policy fails', async () => {
  const r = await auditPlaceholders({ projectRoot: fixture('web-bad-vanilla-pwa') });
  assert.equal(r.severity, 'fail');
  assert.ok(r.findings.length >= 1);
  assert.ok(r.findings.some((f) => f.message.includes('TODO')));
});

test('web-good-clean-pwa: clean content, 0 findings', async () => {
  const r = await auditPlaceholders({ projectRoot: fixture('web-good-clean-pwa') });
  assert.equal(r.severity, 'pass');
  assert.equal(r.findings.length, 0);
});

test('empty-no-stack: scans README, applicable:true, pass', async () => {
  const r = await auditPlaceholders({ projectRoot: fixture('empty-no-stack') });
  assert.equal(r.severity, 'pass');
  assert.notEqual(r.applicable, false);
  assert.equal(r.findings.length, 0);
});

test('placeholders-lowercase-todo: lowercase "todo" content does NOT fail (FIX 5)', async () => {
  const r = await auditPlaceholders({ projectRoot: fixture('placeholders-lowercase-todo') });
  assert.equal(r.severity, 'pass');
  assert.notEqual(r.applicable, false);
  assert.ok(
    !r.findings.some((f) => f.message.includes('TODO marker')),
    'lowercase "todo" must not match the TODO marker',
  );
  assert.equal(r.findings.length, 0);
});
