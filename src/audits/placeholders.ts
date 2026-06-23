// AADC Standards 4 (transparency) + 6 (uphold your published terms).
//
// Scans declared content / strings for obvious placeholder values
// that should never have shipped: TODO markers, example.com URLs,
// "lorem ipsum", "REPLACE ME", obvious dev-stub form URLs.
//
// Scans shipped content / source file types (see SCAN_EXTENSIONS:
// .md, .json, .yaml, .yml, .mjs, .js, .ts, .dart, .html, .plist, .xml)
// for placeholder markers, skipping dist, tests, and changelog/roadmap
// docs.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';

const PLACEHOLDER_PATTERNS: Array<{ re: RegExp; label: string }> = [
  // Case-SENSITIVE so only the uppercase code markers TODO / FIXME
  // match: the ordinary English word "todo" (a to-do-list kids app)
  // must not hard-fail as unreplaced placeholder content.
  { re: /\bTODO\b/, label: 'TODO marker' },
  { re: /\bFIXME\b/, label: 'FIXME marker' },
  { re: /\bREPLACE[ _-]?ME\b/i, label: 'REPLACE ME placeholder' },
  { re: /lorem ipsum/i, label: 'Lorem ipsum text' },
  { re: /\bexample\.com\b/i, label: 'example.com URL' },
  { re: /\bxxxx+\b/i, label: 'xxxx placeholder' },
  { re: /\{\{[A-Z_]+\}\}/, label: 'unresolved {{TEMPLATE_VAR}}' },
  // Dev-stub form / share URLs (best-effort heuristic): an https://forms.gle
  // path containing all-caps placeholder text or "TBD" / "TODO" is almost
  // certainly never a real Google Form ID (which is opaque base64).
  { re: /forms\.gle\/[A-Z][A-Z0-9_-]{2,}/, label: 'forms.gle URL using a placeholder slug rather than a real Form ID' },
  { re: /bit\.ly\/[A-Z][A-Z0-9_-]{2,}/, label: 'bit.ly URL using a placeholder slug' },
];

const SCAN_EXTENSIONS = ['.md', '.json', '.yaml', '.yml', '.mjs', '.js', '.ts', '.dart', '.html', '.plist', '.xml', '.htm', '.jsx', '.tsx', '.vue', '.svelte', '.cjs'];

export async function auditPlaceholders(opts: AuditOptions): Promise<AuditResult> {
  const findings: AuditFinding[] = [];
  let scanned = 0;

  for (const file of walk(opts.projectRoot, {
    filter: (p) => {
      if (!SCAN_EXTENSIONS.some((ext) => p.endsWith(ext))) return false;
      // Skip dist + the project's OWN test dirs, matched RELATIVE to the
      // project root so an ancestor "tests" dir outside the project does
      // not skip everything.
      const rel = '/' + relative(opts.projectRoot, p).split('\\').join('/');
      if (rel.includes('/dist/') || rel.includes('/test/') || rel.includes('/tests/')) return false;
      if (p.includes('CHANGELOG') || p.includes('ROADMAP')) return false;
      return true;
    },
  })) {
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    scanned++;
    const lines = body.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip code-comment lines containing the patterns; only flag if
      // the pattern is in a string or content position. Heuristic: if
      // the matching token is the entire interesting part of the line
      // (e.g. inside quotes), flag it.
      for (const { re, label } of PLACEHOLDER_PATTERNS) {
        if (!re.test(line)) continue;
        // Skip Dart / JS line-comment lines.
        if (/^\s*(\/\/|#|<!--)/.test(line)) continue;
        // Skip JSDoc / dartdoc.
        if (/^\s*\*\s/.test(line)) continue;
        findings.push({
          where: `${relative(opts.projectRoot, file)}:${i + 1}`,
          message: `Possible ${label}: "${line.trim().slice(0, 140)}"`,
          standards: [4, 6],
        });
        break;
      }
    }
  }

  if (scanned === 0) {
    return {
      id: 'placeholders',
      title: 'Placeholder content not yet replaced',
      standards: [4, 6],
      severity: 'pass',
      findings: [],
      applicable: false,
      scanned: 0,
      summary: 'No content/source files found; nothing to audit.',
    };
  }

  return {
    id: 'placeholders',
    title: 'Placeholder content not yet replaced',
    standards: [4, 6],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    scanned,
    summary:
      findings.length === 0
        ? 'No placeholder markers, lorem ipsum, example.com URLs, or unresolved template variables found in shipped content.'
        : `${findings.length} placeholder marker(s): content was published without being finalised.`,
  };
}
