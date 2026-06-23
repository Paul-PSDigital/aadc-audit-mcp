// Runtime fixture-path resolver for the test suite.
//
// Tests walk() real on-disk mini-projects under tests/fixtures/. Those
// fixtures are DATA (excluded from tsc), so they stay in the source tree
// and are never copied into dist-test/. This helper resolves a fixture
// name to its absolute source-tree path.
//
// The compiled helper sits at <repo>/dist-test/tests/helpers/fixtures.js,
// so we walk up three levels (helpers -> tests -> dist-test) to the repo
// root and then into the source-tree tests/fixtures/ directory.
//
// Uses fileURLToPath(import.meta.url) + dirname, the same idiom
// src/standards.ts uses, rather than import.meta.dirname (which needs a
// newer Node than the project's engines '>=18.0.0').

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function fixture(name: string): string {
  const p = resolve(here, '../../../tests/fixtures', name);
  if (!existsSync(p)) {
    throw new Error(`fixture missing: ${p}`);
  }
  return p;
}
