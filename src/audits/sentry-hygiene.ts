// AADC Standard 7 (default settings) + Standard 9 (data sharing).
//
// If a project includes the sentry_flutter SDK, its initialisation
// must set the privacy-protective options explicitly. Sentry's
// defaults send IP address + a synthesized user ID; for a kids app,
// every relevant option must be flipped to off.
//
// Flagged unless the project's main entry points contain BOTH:
//   - sendDefaultPii = false
//   - attachScreenshot = false (if the option is even referenced;
//     in newer SDK versions it's off by default)
//
// Audit is a no-op for projects that don't depend on sentry_flutter.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';

const SENTRY_REQUIRED_FLAGS = [
  {
    re: /sendDefaultPii\s*=\s*false/,
    name: 'sendDefaultPii = false',
    why: 'Without this, Sentry attaches IP address + a synthesised user ID to every event.',
  },
  {
    re: /attachScreenshot\s*=\s*false/,
    name: 'attachScreenshot = false',
    why: 'A screenshot of a kids app could include a child\'s name greeting / hearing test result.',
  },
];

export async function auditSentryHygiene(opts: AuditOptions): Promise<AuditResult> {
  // First: does the project even use Sentry?
  let usesSentry = false;
  for (const f of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('/pubspec.yaml'),
  })) {
    let body: string;
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    if (/sentry_flutter:/.test(body)) {
      usesSentry = true;
      break;
    }
  }
  if (!usesSentry) {
    return {
      id: 'sentry-hygiene',
      title: 'Sentry initialisation hygiene',
      standards: [7, 9],
      severity: 'pass',
      findings: [],
      summary: 'Project does not depend on sentry_flutter; audit skipped.',
    };
  }

  // Find files that import sentry_flutter and look for the init call.
  const findings: AuditFinding[] = [];
  let foundInitFile = false;
  for (const file of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('.dart'),
  })) {
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    if (!/SentryFlutter\.init/.test(body)) continue;
    foundInitFile = true;
    for (const { re, name, why } of SENTRY_REQUIRED_FLAGS) {
      if (!re.test(body)) {
        findings.push({
          where: relative(opts.projectRoot, file),
          message: `SentryFlutter.init() missing "${name}". ${why}`,
          standards: [7, 9],
        });
      }
    }
  }

  if (!foundInitFile) {
    findings.push({
      where: 'pubspec.yaml',
      message: 'sentry_flutter declared in pubspec.yaml but no SentryFlutter.init() call found in source. ' +
        'Either remove the dependency or wire init with sendDefaultPii=false.',
      standards: [7, 9],
    });
  }

  return {
    id: 'sentry-hygiene',
    title: 'Sentry initialisation hygiene',
    standards: [7, 9],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    summary:
      findings.length === 0
        ? 'Sentry initialised with privacy-protective options set explicitly.'
        : `${findings.length} Sentry config issue(s) — child crash reports may leak PII or screenshots.`,
  };
}
