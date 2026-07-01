// Dependency-free self-test for the three presence/process audits added
// in 0.3.2: dpia-present (Standard 2), age-assurance (Standard 3), and
// data-rights-tools (Standard 15).
//
// It uses only Node built-ins and the compiled audit registry under
// ../dist, so it runs anywhere the tool itself runs. `npm test` builds
// dist first; you can also run it directly with `node tests/run.mjs`
// once dist exists.
//
// Each case points an audit at a tiny isolated fixture project under
// tests/fixtures/ and asserts the resulting severity. This harness
// currently covers the three new audits only; the older audits are
// exercised by the separate node:test suite (tests/*.test.ts).

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUDITS } from '../dist/audits/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = resolve(here, 'fixtures');

// id: registry key. fixture: path under tests/fixtures. opts: extra
// AuditOptions.options merged in. expected: the severity we require.
const CASES = [
  { id: 'dpia-present', fixture: 'dpia-present/missing', opts: {}, expected: 'warn' },
  { id: 'dpia-present', fixture: 'dpia-present/stub', opts: {}, expected: 'warn' },
  { id: 'dpia-present', fixture: 'dpia-present/good', opts: {}, expected: 'pass' },
  { id: 'age-assurance', fixture: 'age-assurance/missing', opts: {}, expected: 'warn' },
  {
    id: 'age-assurance',
    fixture: 'age-assurance/missing',
    opts: { ageStrategy: 'all-users' },
    expected: 'pass',
  },
  { id: 'age-assurance', fixture: 'age-assurance/good', opts: {}, expected: 'pass' },
  { id: 'data-rights-tools', fixture: 'data-rights-tools/missing', opts: {}, expected: 'warn' },
  { id: 'data-rights-tools', fixture: 'data-rights-tools/good', opts: {}, expected: 'pass' },
];

function label(c) {
  const name = c.fixture.split('/').pop();
  const strat = c.opts && c.opts.ageStrategy ? `, ${c.opts.ageStrategy}` : '';
  return `${name}${strat}`;
}

let failures = 0;

for (const c of CASES) {
  const audit = AUDITS[c.id];
  if (typeof audit !== 'function') {
    failures++;
    console.error(`FAIL ${c.id} [${label(c)}] -> no such audit in registry`);
    continue;
  }
  const projectRoot = resolve(fixturesRoot, c.fixture);
  let result;
  try {
    result = await audit({ projectRoot, options: c.opts });
  } catch (err) {
    failures++;
    const msg = err && err.message ? err.message : String(err);
    console.error(`FAIL ${c.id} [${label(c)}] -> threw: ${msg}`);
    continue;
  }
  if (result.severity === c.expected) {
    console.log(`PASS ${c.id} [${label(c)}] -> ${result.severity}`);
  } else {
    failures++;
    console.error(
      `FAIL ${c.id} [${label(c)}] -> expected ${c.expected}, got ${result.severity}`,
    );
    console.error(`     summary: ${result.summary}`);
  }
}

console.log('');
if (failures > 0) {
  console.error(`${failures} of ${CASES.length} self-test case(s) failed.`);
  process.exit(1);
}
console.log(`All ${CASES.length} self-test cases passed.`);
process.exit(0);
