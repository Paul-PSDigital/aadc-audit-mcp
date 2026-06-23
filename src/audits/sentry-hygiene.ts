// AADC Standard 7 (default settings) + Standard 9 (data sharing).
//
// If a project includes the sentry_flutter SDK (or an @sentry/* npm
// package), its initialisation must set the privacy-protective options
// explicitly. Sentry's defaults send IP address + a synthesized user
// ID; for a kids app, every relevant option must be flipped to off.
//
// Flagged unless the project's main entry points contain BOTH:
//   - sendDefaultPii = false
//   - attachScreenshot = false (if the option is even referenced;
//     in newer SDK versions it's off by default)
//
// Audit is N/A for projects that depend on neither sentry_flutter nor
// any @sentry/* npm package.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';
import { extractNpmDeps } from './sdks.js';

// JS/TS source extensions where a web Sentry.init lives. Deliberately
// excludes .html/.vue/.svelte: Sentry.init is wired in plain JS/TS.
const JS_INIT_EXTS = ['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx'];

function isJsInitFile(p: string): boolean {
  return JS_INIT_EXTS.some((ext) => p.endsWith(ext));
}

const SENTRY_REQUIRED_FLAGS = [
  {
    re: /sendDefaultPii\s*=\s*false/,
    name: 'sendDefaultPii = false',
    why: 'Without this, Sentry attaches IP address + a synthesised user ID to every event.',
  },
  {
    re: /attachScreenshot\s*=\s*false/,
    name: 'attachScreenshot = false',
    why: 'A screenshot of a kids app could include a child\'s name, message content, or other personal data shown on screen.',
  },
];

export async function auditSentryHygiene(opts: AuditOptions): Promise<AuditResult> {
  // First: does the project even use Sentry? Either the Flutter
  // sentry_flutter package or an @sentry/* npm package counts.
  let usesFlutterSentry = false;
  for (const f of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('/pubspec.yaml'),
  })) {
    let body: string;
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    if (/sentry_flutter:/.test(body)) {
      usesFlutterSentry = true;
      break;
    }
  }

  let usesNpmSentry = false;
  for (const f of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('/package.json'),
  })) {
    let body: string;
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    if (extractNpmDeps(body).some((dep) => dep.startsWith('@sentry/'))) {
      usesNpmSentry = true;
      break;
    }
  }

  const usesSentry = usesFlutterSentry || usesNpmSentry;
  if (!usesSentry) {
    return {
      id: 'sentry-hygiene',
      title: 'Sentry initialisation hygiene',
      standards: [7, 9],
      severity: 'pass',
      findings: [],
      applicable: false,
      scanned: 0,
      summary: 'No Sentry dependency (sentry_flutter or @sentry/*) found; nothing to audit. Add a Sentry SDK to make this audit applicable.',
    };
  }

  // Find files that import sentry_flutter and look for the init call.
  // The Dart SentryFlutter.init flags remain the authoritative check.
  const findings: AuditFinding[] = [];
  let foundDartInit = false;
  let foundJsInit = false;
  // The dependency manifest that established Sentry usage is itself an
  // examined input, so a Sentry-using project is always applicable even
  // when it has no Dart source (e.g. an npm-only web app).
  let scanned = 1;
  for (const file of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('.dart'),
  })) {
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    scanned++;
    if (!/SentryFlutter\.init/.test(body)) continue;
    foundDartInit = true;
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

  // Web init scan: an npm @sentry/* app wires Sentry in JS/TS via
  // Sentry.init(...). Walk JS/TS source for the init call and check the
  // JS hygiene flags. The Dart checks above remain authoritative.
  for (const file of walk(opts.projectRoot, {
    filter: (p) => isJsInitFile(p),
  })) {
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    scanned++;
    if (!/Sentry\.init\s*\(/.test(body)) continue;
    foundJsInit = true;
    const where = relative(opts.projectRoot, file);
    // sendDefaultPii: true attaches PII (IP + user context) to every
    // event. For a kids app this must be off.
    if (/sendDefaultPii\s*:\s*true/.test(body)) {
      findings.push({
        where,
        message: 'Sentry.init() sets sendDefaultPii: true, which attaches PII (IP address + user context) to every event. ' +
          'Set sendDefaultPii: false for a kids app.',
        standards: [7, 9],
      });
    }
    // Session replay can record a child's screen (names, messages, other
    // PII shown on screen). A nonzero replaysSessionSampleRate or any
    // Replay integration token enables it. The value is parsed so that
    // an explicit 0 / 0.0 reads as off (a bare /(?!0)/ lookahead would
    // backtrack onto the whitespace and false-positive on ": 0").
    const replayRate = /replaysSessionSampleRate\s*:\s*([0-9.]+)/.exec(body);
    const replayOn = replayRate ? parseFloat(replayRate[1]) > 0 : false;
    if (
      replayOn ||
      /replayIntegration|new\s+Replay|browserReplayIntegration/.test(body)
    ) {
      findings.push({
        where,
        message: 'Sentry.init() enables session replay (a nonzero replaysSessionSampleRate or a Replay integration). ' +
          'Session replay can capture a child\'s screen and on-screen PII. Disable it (replaysSessionSampleRate: 0, no Replay integration).',
        standards: [7, 9],
      });
    }
  }

  // Only warn about a declared-but-uninitialised Sentry when NEITHER a
  // Dart SentryFlutter.init NOR a JS Sentry.init was found anywhere.
  if (!foundDartInit && !foundJsInit) {
    findings.push({
      where: 'pubspec.yaml / package.json',
      message: 'Sentry (sentry_flutter or @sentry/*) declared but no SentryFlutter.init() / Sentry.init() call found in source. ' +
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
    scanned,
    summary:
      findings.length === 0
        ? 'Sentry initialised with privacy-protective options set explicitly.'
        : `${findings.length} Sentry config issue(s): child crash reports may leak PII or screenshots.`,
  };
}
