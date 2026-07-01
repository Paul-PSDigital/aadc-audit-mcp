// Tests for the parent-gate audit (Standard 11).
//
// Covers: a declared parent area with no gate mechanism (warn), a gate
// that exists but is trivially bypassable (warn), a gate with a strong
// challenge (pass), and applicable:false when no parent-area paths are
// declared (N/A).

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditParentGate } from '../src/audits/parent-gate.js';
import { fixture } from './helpers/fixtures.js';

test('parent-gate no-gate: declared parent area with no gate mechanism warns', async () => {
  const r = await auditParentGate({
    projectRoot: fixture('parent-gate/no-gate'),
    allowlists: { parentAreaPaths: ['parent'] },
  });
  assert.equal(r.severity, 'warn');
  assert.notEqual(r.applicable, false);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].where, '(project)');
});

test('parent-gate trivial-gate: one-tap affirm with no strong challenge warns', async () => {
  const r = await auditParentGate({
    projectRoot: fixture('parent-gate/trivial-gate'),
    allowlists: { parentAreaPaths: ['parent'] },
  });
  assert.equal(r.severity, 'warn');
  assert.notEqual(r.applicable, false);
  assert.equal(r.findings.length, 1);
  assert.ok(r.findings[0].where.includes('parent/gate.dart'));
});

test('parent-gate strong-gate: gate token plus a strong challenge passes', async () => {
  const r = await auditParentGate({
    projectRoot: fixture('parent-gate/strong-gate'),
    allowlists: { parentAreaPaths: ['parent'] },
  });
  assert.equal(r.severity, 'pass');
  assert.notEqual(r.applicable, false);
  assert.equal(r.findings.length, 0);
});

test('parent-gate no-parent-area-declared: applicable:false / pass (N/A)', async () => {
  const r = await auditParentGate({ projectRoot: fixture('parent-gate/no-gate') });
  assert.equal(r.applicable, false);
  assert.equal(r.severity, 'pass');
  assert.equal(r.scanned, 0);
  assert.equal(r.findings.length, 0);
});
