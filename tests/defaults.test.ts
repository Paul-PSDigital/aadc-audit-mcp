// Tests for the defaults audit (Standard 7).
//
// Heuristic, warn-only: suspicious default-true settings WARN (never
// fail, so they never flip the exit code), while privacy-positive
// defaults and non-suspicious keys are NOT flagged.

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditDefaults } from '../src/audits/defaults.js';
import { fixture } from './helpers/fixtures.js';

test('defaults-bad: suspicious default-true settings WARN, applicable:true', async () => {
  const r = await auditDefaults({ projectRoot: fixture('defaults-bad') });
  assert.equal(r.severity, 'warn');
  assert.notEqual(r.severity, 'fail'); // warn must never flip the exit code
  assert.notEqual(r.applicable, false);
  assert.ok(r.findings.length >= 2, `expected >=2 findings, got ${r.findings.length}`);
  assert.ok(r.findings.every((f) => f.standards.includes(7)));
});

test('defaults-good: privacy-positive + non-suspicious defaults NOT flagged', async () => {
  const r = await auditDefaults({ projectRoot: fixture('defaults-good') });
  assert.equal(r.severity, 'pass');
  assert.equal(r.findings.length, 0);
});
