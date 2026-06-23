// Tests for the volume-cap audit (Standards 1, 14).
//
// Covers web HTMLMediaElement surfaces plus Dart players: an uncapped
// new Audio()/<audio autoplay> FAILS, a clamped player PASSES, and a
// project with no audio/video source is applicable:false.

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditVolumeCap } from '../src/audits/volume-cap.js';
import { fixture } from './helpers/fixtures.js';

test('web-bad-vanilla-pwa: flags uncapped audio surface', async () => {
  const r = await auditVolumeCap({ projectRoot: fixture('web-bad-vanilla-pwa') });
  assert.equal(r.severity, 'fail');
  assert.notEqual(r.applicable, false);
  assert.ok(r.findings.length >= 1, `expected >=1 finding, got ${r.findings.length}`);
  assert.ok(typeof r.scanned === 'number' && r.scanned >= 1);
  // The message references the volume clamp surface.
  assert.ok(r.findings.some((f) => /volume/i.test(f.message)));
});

test('web-good-clean-pwa: audio.volume=0.6 is NOT flagged', async () => {
  const r = await auditVolumeCap({ projectRoot: fixture('web-good-clean-pwa') });
  assert.equal(r.severity, 'pass');
  assert.notEqual(r.applicable, false);
  assert.equal(r.findings.length, 0);
});

test('flutter-nonstandard-layout: AudioPlayer with no setVolume fails off apps/mobile', async () => {
  const r = await auditVolumeCap({ projectRoot: fixture('flutter-nonstandard-layout') });
  assert.equal(r.severity, 'fail');
  assert.equal(r.findings.length, 1);
  assert.ok(r.findings[0].where.startsWith('packages/player/'));
});

test('empty-no-stack: applicable:false with scanned 0 when no source', async () => {
  const r = await auditVolumeCap({ projectRoot: fixture('empty-no-stack') });
  assert.equal(r.applicable, false);
  assert.equal(r.severity, 'pass');
  assert.equal(r.scanned, 0);
  assert.equal(r.findings.length, 0);
});
