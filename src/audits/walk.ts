// Shared file-walking helper. Filesystem walk that skips the common
// noise directories (node_modules, build, etc) every audit needs.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_SKIP = new Set([
  'node_modules',
  '.git',
  '.dart_tool',
  'build',
  'dist',
  '.next',
  '.nuxt',
  '.venv',
  '__pycache__',
  '.tox',
  '.gradle',
  'Pods',
  'DerivedData',
  '.dSYM',
]);

export interface WalkOptions {
  /** Additional names to skip on top of the defaults. */
  skip?: Iterable<string>;
  /** Filter applied to file paths; only matching files are yielded. */
  filter?: (path: string) => boolean;
}

export function* walk(root: string, opts: WalkOptions = {}): Generator<string> {
  const skip = new Set(DEFAULT_SKIP);
  if (opts.skip) for (const s of opts.skip) skip.add(s);

  function* go(dir: string): Generator<string> {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skip.has(entry)) continue;
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        yield* go(full);
      } else if (st.isFile()) {
        if (!opts.filter || opts.filter(full)) yield full;
      }
    }
  }

  yield* go(root);
}
