// Tests for the launchurl audit (Standards 11, 14).
//
// Covers web external-navigation escapes (target=_blank, window.open)
// plus Dart launchUrl, the false-positive guard for same-origin links,
// and applicable:false on an empty project.

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditLaunchUrl } from '../src/audits/launchurl.js';
import { fixture } from './helpers/fixtures.js';

test('web-bad-vanilla-pwa: flags target=_blank outbound navigation', async () => {
  const r = await auditLaunchUrl({ projectRoot: fixture('web-bad-vanilla-pwa') });
  assert.equal(r.severity, 'fail');
  assert.notEqual(r.applicable, false);
  assert.ok(r.findings.length >= 1, `expected >=1 finding, got ${r.findings.length}`);
  assert.ok(typeof r.scanned === 'number' && r.scanned >= 1);
});

test('web-good-clean-pwa: same-origin relative links are NOT flagged', async () => {
  const r = await auditLaunchUrl({ projectRoot: fixture('web-good-clean-pwa') });
  assert.equal(r.severity, 'pass');
  assert.notEqual(r.applicable, false);
  assert.equal(r.findings.length, 0);
});

test('flutter-nonstandard-layout: launchUrl literal fails off apps/mobile', async () => {
  const r = await auditLaunchUrl({ projectRoot: fixture('flutter-nonstandard-layout') });
  assert.equal(r.severity, 'fail');
  assert.equal(r.findings.length, 1);
  assert.ok(r.findings[0].where.startsWith('packages/player/'));
});

test('empty-no-stack: applicable:false with scanned 0 when no source', async () => {
  const r = await auditLaunchUrl({ projectRoot: fixture('empty-no-stack') });
  assert.equal(r.applicable, false);
  assert.equal(r.severity, 'pass');
  assert.equal(r.scanned, 0);
  assert.equal(r.findings.length, 0);
});

test('launchurl-dart-comments: // and /* */ launchUrl mentions are not flagged, real call is (FIX 7)', async () => {
  const r = await auditLaunchUrl({ projectRoot: fixture('launchurl-dart-comments') });
  assert.equal(r.severity, 'fail');
  assert.notEqual(r.applicable, false);
  // Only the real launchUrl call (line 10) flags; the two comment lines
  // (5, 6) do not.
  assert.equal(r.findings.length, 1);
  assert.ok(r.findings[0].where.endsWith(':10'), `unexpected where: ${r.findings[0].where}`);
});

test('launchurl-multiline-anchor: multi-line <a target=_blank href=...> is flagged (FIX 7)', async () => {
  const r = await auditLaunchUrl({ projectRoot: fixture('launchurl-multiline-anchor') });
  assert.equal(r.severity, 'fail');
  assert.notEqual(r.applicable, false);
  assert.ok(r.findings.length >= 1, `expected >=1 finding, got ${r.findings.length}`);
  assert.ok(r.findings.some((f) => f.message.includes('external.example.org')));
  // Cited at the line where "<a" began.
  assert.ok(r.findings.some((f) => f.where.endsWith(':4')), 'finding should cite the <a line');
});
