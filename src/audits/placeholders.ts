// AADC Standards 4 (transparency) + 6 (uphold your published terms).
//
// Scans declared content / strings for obvious placeholder values
// that should never have shipped: TODO markers, example.com URLs,
// "lorem ipsum", "REPLACE ME", obvious dev-stub form URLs.
//
// Default file globs: any .md, .json, .yaml, .yml, .mjs, .js, .ts,
// .dart file with "uiStrings" / "uistring" / "i18n" / "translations"
// in the path, plus any HTML privacy / about page.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';

const PLACEHOLDER_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bTODO\b/i, label: 'TODO marker' },
  { re: /\bFIXME\b/i, label: 'FIXME marker' },
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

const SCAN_EXTENSIONS = ['.md', '.json', '.yaml', '.yml', '.mjs', '.js', '.ts', '.dart', '.html', '.plist', '.xml'];

export async function auditPlaceholders(opts: AuditOptions): Promise<AuditResult> {
  const findings: AuditFinding[] = [];

  for (const file of walk(opts.projectRoot, {
    filter: (p) =>
      SCAN_EXTENSIONS.some((ext) => p.endsWith(ext)) &&
      !p.includes('/dist/') &&
      !p.includes('/test/') &&
      !p.includes('/tests/') &&
      !p.includes('CHANGELOG') &&
      !p.includes('ROADMAP'),
  })) {
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
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

  return {
    id: 'placeholders',
    title: 'Placeholder content not yet replaced',
    standards: [4, 6],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    summary:
      findings.length === 0
        ? 'No placeholder markers, lorem ipsum, example.com URLs, or unresolved template variables found in shipped content.'
        : `${findings.length} placeholder marker(s) — content was published without being finalised.`,
  };
}
