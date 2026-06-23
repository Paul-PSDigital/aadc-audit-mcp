// Tests for the Tier-3 applicability contract across every audit.
//
// Running the full registry over a docs-only project must produce ZERO
// fails (so the CLI exit code is 0 and the MCP isError is false), every
// severity must remain one of pass/warn/fail, and any applicable:false
// result must carry scanned:0.

import test from 'node:test';
import assert from 'node:assert/strict';

import { runAll } from '../src/audits/index.js';
import { fixture } from './helpers/fixtures.js';

test('empty-no-stack: runAll produces no fails and a clean contract', async () => {
  const results = await runAll({ projectRoot: fixture('empty-no-stack') });
  assert.ok(results.length > 0, 'expected at least one audit result');

  for (const r of results) {
    // Severity is always one of the three allowed values; 'na' is never
    // added to the union.
    assert.ok(
      r.severity === 'pass' || r.severity === 'warn' || r.severity === 'fail',
      `unexpected severity for ${r.id}: ${r.severity}`,
    );

    // No audit may fail on a project that simply lacks its inputs.
    assert.notEqual(r.severity, 'fail', `${r.id} must not fail on an empty project`);

    // scanned is a non-negative number or undefined.
    if (r.scanned !== undefined) {
      assert.equal(typeof r.scanned, 'number', `${r.id} scanned must be a number`);
      assert.ok(r.scanned >= 0, `${r.id} scanned must be >= 0`);
    }

    // applicable:false must pair with severity:'pass' and scanned:0.
    if (r.applicable === false) {
      assert.equal(r.severity, 'pass', `${r.id} applicable:false must pair with pass`);
      assert.equal(r.scanned, 0, `${r.id} applicable:false must pair with scanned:0`);
    }
  }

  // Exit-code / isError neutrality: nothing fails on an empty project.
  assert.equal(
    results.some((r) => r.severity === 'fail' && r.applicable !== false),
    false,
  );
});
