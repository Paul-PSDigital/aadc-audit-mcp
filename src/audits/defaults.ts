// AADC Standard 7 (default settings).
//
// Heuristic warn-only audit: scans code for declarations of persisted
// settings whose default value would expose a child without an opt-in.
// Lists every match for human review rather than claiming to catch all
// violations.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';

const DEFAULT_KEY_PATTERN =
  /share|track|analytics|ads|advertising|location|profile|profiling|personali[sz]ation|recommend|social|nudge/i;

const DART_DEFAULT_TRUE = /(default_value|defaultValue|default)\s*[:=]\s*true/;
const JS_PRODUCTION_TRUE = /production[^:=]*[:=]\s*true/;

export async function auditDefaults(opts: AuditOptions): Promise<AuditResult> {
  const keyPattern = opts.options?.suspiciousKeyRegex
    ? new RegExp(opts.options.suspiciousKeyRegex, 'i')
    : DEFAULT_KEY_PATTERN;
  const findings: AuditFinding[] = [];

  // Dart: anything that looks like a `default(_value)? = true` on a
  // suspicious key.
  for (const file of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('.dart'),
  })) {
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = body.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (DART_DEFAULT_TRUE.test(line) && keyPattern.test(line)) {
        findings.push({
          where: `${relative(opts.projectRoot, file)}:${i + 1}`,
          message: `Default-true with suspicious key. Confirm AADC Standard 7 (high-privacy defaults).`,
          standards: [7],
        });
      }
    }
  }

  // JSON / YAML / JS feature-flag style declarations.
  for (const file of walk(opts.projectRoot, {
    filter: (p) =>
      p.endsWith('.json') ||
      p.endsWith('.yaml') ||
      p.endsWith('.yml') ||
      p.endsWith('.mjs') ||
      p.endsWith('.js') ||
      p.endsWith('.ts'),
  })) {
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = body.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (JS_PRODUCTION_TRUE.test(line) && keyPattern.test(line)) {
        findings.push({
          where: `${relative(opts.projectRoot, file)}:${i + 1}`,
          message: `Feature-flag production:true on a suspicious key. Review for AADC Standard 7.`,
          standards: [7],
        });
      }
    }
  }

  return {
    id: 'defaults',
    title: 'Privacy-positive defaults',
    standards: [7],
    severity: findings.length === 0 ? 'pass' : 'warn',
    findings,
    summary:
      findings.length === 0
        ? 'No suspicious-key defaults found.'
        : `${findings.length} suspicious default(s) flagged for human review. This audit is heuristic; cross-check each against the conformance statement.`,
  };
}
