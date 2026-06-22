// Loader for the canonical ICO AADC text shipped with the package.
//
// At runtime the markdown lives under `aadc/` relative to the package
// root (one level above `dist/`). We read it lazily and expose two
// shapes: a list of one-line summaries and a per-standard full text
// loader.

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// dist/standards.js → package root
const PACKAGE_ROOT = resolve(here, '..');
const AADC_DIR = join(PACKAGE_ROOT, 'aadc');

export interface StandardSummary {
  number: number;
  title: string;
  slug: string;
  summary: string;
}

const TITLE_MAP: Record<number, string> = {
  1: 'Best interests of the child',
  2: 'Data protection impact assessments',
  3: 'Age-appropriate application',
  4: 'Transparency',
  5: 'Detrimental use of data',
  6: 'Policies and community standards',
  7: 'Default settings',
  8: 'Data minimisation',
  9: 'Data sharing',
  10: 'Geolocation',
  11: 'Parental controls',
  12: 'Profiling',
  13: 'Nudge techniques',
  14: 'Connected toys and devices',
  15: 'Online tools',
};

export async function readStandardSummaries(): Promise<StandardSummary[]> {
  const out: StandardSummary[] = [];
  for (let n = 1; n <= 15; n++) {
    const slug = await findSlugFor(n);
    const summary = slug ? await firstParagraphOf(slug) : '';
    out.push({
      number: n,
      title: TITLE_MAP[n],
      slug: slug ?? '',
      summary: summary.slice(0, 280),
    });
  }
  return out;
}

export async function readStandardFullText(n: number): Promise<string> {
  const slug = await findSlugFor(n);
  if (!slug) throw new Error(`Standard ${n} not found in aadc/`);
  return readFile(join(AADC_DIR, `${slug}.md`), 'utf8');
}

async function findSlugFor(n: number): Promise<string | undefined> {
  let entries: string[];
  try {
    entries = await readdir(AADC_DIR);
  } catch {
    return undefined;
  }
  const match = entries.find((e) => e.startsWith(`${n}-`) && e.endsWith('.md'));
  return match ? match.replace(/\.md$/, '') : undefined;
}

async function firstParagraphOf(slug: string): Promise<string> {
  let body: string;
  try {
    body = await readFile(join(AADC_DIR, `${slug}.md`), 'utf8');
  } catch {
    return '';
  }
  // ICO format: each page starts with a yellow callout containing the
  // one-line statutory summary. Pull that out specifically.
  const callout = body.match(/<div class="rt-block rt-amber">\s*([\s\S]+?)\s*<\/div>/);
  if (callout) return callout[1].trim();
  // Fallback: first non-empty paragraph after the H2.
  const lines = body.split('\n');
  let started = false;
  const buf: string[] = [];
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (started) break;
      started = true;
      continue;
    }
    if (started && line.trim()) buf.push(line.trim());
    if (started && !line.trim() && buf.length) break;
  }
  return buf.join(' ');
}
