// Tests for the parent-gate-routes audit (Standard 11).
//
// Covers: a declared parent-area file that references no gate or guard
// (warn), a declared parent-area file that references a guard (pass), and
// applicable:false when no parent-area paths are declared (N/A).

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditParentGateRoutes } from '../src/audits/parent-gate-routes.js';
import { fixture } from './helpers/fixtures.js';

test('parent-gate-routes unguarded: parent-area file with no gate/guard warns', async () => {
  const r = await auditParentGateRoutes({
    projectRoot: fixture('parent-gate-routes/unguarded'),
    allowlists: { parentAreaPaths: ['parent'] },
  });
  assert.equal(r.severity, 'warn');
  assert.notEqual(r.applicable, false);
  assert.equal(r.findings.length, 1);
  assert.ok(r.findings[0].where.includes('parent/dashboard.dart'));
});

test('parent-gate-routes guarded: parent-area file referencing a guard passes', async () => {
  const r = await auditParentGateRoutes({
    projectRoot: fixture('parent-gate-routes/guarded'),
    allowlists: { parentAreaPaths: ['parent'] },
  });
  assert.equal(r.severity, 'pass');
  assert.notEqual(r.applicable, false);
  assert.equal(r.findings.length, 0);
});

test('parent-gate-routes no-parent-area-declared: applicable:false / pass (N/A)', async () => {
  const r = await auditParentGateRoutes({ projectRoot: fixture('parent-gate-routes/guarded') });
  assert.equal(r.applicable, false);
  assert.equal(r.severity, 'pass');
  assert.equal(r.scanned, 0);
  assert.equal(r.findings.length, 0);
});
