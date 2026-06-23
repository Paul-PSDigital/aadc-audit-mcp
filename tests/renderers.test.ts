// Tests for the report renderers and the not-applicable tally.
//
// Builds AuditResult arrays by hand (no real audits needed) to prove:
//   - formatReport (CLI) renders applicable:false as N/A, never PASS.
//   - the tally line reads exactly "N passed, N warnings, N failed,
//     N not applicable" and the four counts sum to results.length.
//   - an applicable:false result with severity:'warn' counts as
//     not-applicable, not as a warning or a failure.
//   - renderResult (server) shows a distinct N/A token.

import test from 'node:test';
import assert from 'node:assert/strict';

import { formatReport } from '../src/cli.js';
import { renderResult } from '../src/server.js';
import type { AuditResult } from '../src/audits/index.js';

function naResult(over: Partial<AuditResult> = {}): AuditResult {
  return {
    id: 'demo-na',
    title: 'Demo not-applicable audit',
    standards: [4],
    severity: 'pass',
    findings: [],
    summary: 'No relevant inputs found; nothing to audit.',
    applicable: false,
    scanned: 0,
    ...over,
  };
}

function passResult(): AuditResult {
  return {
    id: 'demo-pass',
    title: 'Demo passing audit',
    standards: [6],
    severity: 'pass',
    findings: [],
    summary: 'All good.',
    scanned: 3,
  };
}

function failResult(): AuditResult {
  return {
    id: 'demo-fail',
    title: 'Demo failing audit',
    standards: [8],
    severity: 'fail',
    findings: [{ where: 'x:1', message: 'bad', standards: [8] }],
    summary: 'One problem.',
    scanned: 1,
  };
}

function warnResult(): AuditResult {
  return {
    id: 'demo-warn',
    title: 'Demo warning audit',
    standards: [7],
    severity: 'warn',
    findings: [{ where: 'y:2', message: 'review', standards: [7] }],
    summary: 'Heuristic flag.',
    scanned: 2,
  };
}

test('formatReport renders an applicable:false result as N/A, not PASS', () => {
  const out = formatReport([naResult()]);
  assert.ok(out.includes('N/A'), 'expected an N/A token');
  assert.ok(!out.includes('PASS'), 'an N/A result must not render as PASS');
});

test('formatReport tally line: exact shape and counts sum to results.length', () => {
  const results = [passResult(), passResult(), warnResult(), failResult(), naResult()];
  const out = formatReport(results);
  // 2 pass, 1 warn, 1 fail, 1 not-applicable.
  assert.ok(
    out.includes('2 passed, 1 warnings, 1 failed, 1 not applicable'),
    `tally line missing or wrong; got:\n${out}`,
  );
  // The four counts must sum to results.length.
  const m = out.match(/(\d+) passed, (\d+) warnings, (\d+) failed, (\d+) not applicable/);
  assert.ok(m, 'tally line not found');
  const sum = Number(m![1]) + Number(m![2]) + Number(m![3]) + Number(m![4]);
  assert.equal(sum, results.length);
});

test('formatReport: applicable:false + severity warn counts as not-applicable, not a warning', () => {
  // The legacy config-gated skip used severity:'warn'; once converted to
  // N/A it must leave the warnings and failed tallies untouched.
  const results = [naResult({ severity: 'warn' })];
  const out = formatReport(results);
  assert.ok(
    out.includes('0 passed, 0 warnings, 0 failed, 1 not applicable'),
    `expected the warn-flagged N/A to count as not-applicable; got:\n${out}`,
  );
});

test('renderResult (server) shows a distinct N/A token', () => {
  const out = renderResult(naResult());
  assert.ok(out.includes('N/A'), 'expected an N/A token in the server head');
  assert.ok(!out.includes('PASS'), 'an N/A result must not read as PASS');
});
