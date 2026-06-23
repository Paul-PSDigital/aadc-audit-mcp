// AADC Standards 5 (detrimental use of data), 9 (data sharing),
// 12 (profiling), 13 (nudge techniques).
//
// Walks dependency manifests for every supported language and flags any
// dependency outside the AADC-safe allowlist, plus hard-blocks common
// analytics / advertising / tracking SDKs regardless of allowlist.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';

const HARD_BLOCKED_SUBSTRINGS = [
  'firebase_analytics',
  'google_mobile_ads',
  'facebook',
  'appsflyer',
  'amplitude',
  'mixpanel',
  'segment',
  'posthog',
  'hotjar',
  'branch.io',
  'adjust',
  'airship',
  'onesignal',
  'iterable',
  'klaviyo',
  'intercom',
  'zendesk',
  'fullstory',
  'smartlook',
];

const DEFAULT_FLUTTER_BASE = [
  'flutter', 'cupertino_icons', 'go_router', 'just_audio', 'audio_session',
  'audio_service', 'video_player', 'drift', 'drift_flutter', 'path_provider',
  'shared_preferences', 'characters', 'http', 'cryptography', 'crypto',
  'url_launcher', 'google_fonts', 'sentry_flutter', 'in_app_review',
  'webview_flutter', 'flutter_lints', 'flutter_launcher_icons',
  'flutter_native_splash', 'flutter_test',
];

const DEFAULT_NPM_BASE = [
  'react', 'react-dom', 'react-native', 'next', 'vite', 'vitest',
  'typescript', 'tslib',
];

const DEFAULT_PYTHON_BASE = [
  'flask', 'fastapi', 'pydantic', 'httpx', 'requests',
];

function isHardBlocked(name: string): string | null {
  const lower = name.toLowerCase();
  for (const blocked of HARD_BLOCKED_SUBSTRINGS) {
    if (lower.includes(blocked)) return blocked;
  }
  return null;
}

export function extractFlutterDeps(yaml: string): string[] {
  const out: string[] = [];
  let inDeps = false;
  for (const raw of yaml.split('\n')) {
    const top = raw.match(/^([a-z_]+):\s*$/);
    if (top) {
      inDeps = top[1] === 'dependencies' || top[1] === 'dev_dependencies';
      continue;
    }
    if (!inDeps) continue;
    // Colon may be end-of-line (expanded form: bare "mixpanel_flutter:"
    // with hosted:/version: on following deeper-indented lines). The
    // 2-space anchor still excludes the 4-space-indented sub-keys.
    const m = raw.match(/^  ([a-z_][a-z0-9_]*):/);
    if (m) out.push(m[1]);
  }
  return out;
}

export function extractNpmDeps(json: string): string[] {
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  const out = new Set<string>();
  for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const name of Object.keys(parsed[key] ?? {})) out.add(name);
  }
  return [...out];
}

export function extractPythonDeps(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([a-zA-Z0-9_.-]+)/);
    if (m) out.push(m[1].toLowerCase());
  }
  return out;
}

export async function auditSdks(opts: AuditOptions): Promise<AuditResult> {
  const flutterAllow = new Set(opts.allowlists?.flutter ?? DEFAULT_FLUTTER_BASE);
  const npmAllow = new Set(opts.allowlists?.npm ?? DEFAULT_NPM_BASE);
  const pythonAllow = new Set(opts.allowlists?.python ?? DEFAULT_PYTHON_BASE);
  const findings: AuditFinding[] = [];
  let scanned = 0;

  const check = (
    name: string,
    source: string,
    language: string,
    allowlist: Set<string>,
  ): void => {
    const blocked = isHardBlocked(name);
    if (blocked) {
      findings.push({
        where: relative(opts.projectRoot, source),
        message: `HARD-BLOCKED ${language} dependency: ${name} (matches '${blocked}')`,
        standards: [5, 9, 12, 13],
      });
      return;
    }
    if (!allowlist.has(name)) {
      findings.push({
        where: relative(opts.projectRoot, source),
        message: `${language} dependency not on AADC allowlist: ${name}`,
        standards: [5, 9, 12, 13],
      });
    }
  };

  // Flutter / Dart
  for (const f of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('/pubspec.yaml'),
  })) {
    let body: string;
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    scanned++;
    for (const dep of extractFlutterDeps(body)) {
      check(dep, f, 'Flutter', flutterAllow);
    }
  }

  // Node / NPM
  for (const f of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('/package.json'),
  })) {
    let body: string;
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    scanned++;
    for (const dep of extractNpmDeps(body)) {
      check(dep, f, 'Node', npmAllow);
    }
  }

  // Python
  for (const f of walk(opts.projectRoot, {
    filter: (p) => /requirements.*\.txt$/.test(p),
  })) {
    let body: string;
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    scanned++;
    for (const dep of extractPythonDeps(body)) {
      check(dep, f, 'Python', pythonAllow);
    }
  }

  if (scanned === 0) {
    return {
      id: 'sdks',
      title: 'Third-party SDK allowlist',
      standards: [5, 9, 12, 13],
      severity: 'pass',
      findings: [],
      applicable: false,
      scanned: 0,
      summary: 'No dependency manifests (pubspec.yaml / package.json / requirements*.txt) found; nothing to audit.',
    };
  }

  return {
    id: 'sdks',
    title: 'Third-party SDK allowlist',
    standards: [5, 9, 12, 13],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    scanned,
    summary:
      findings.length === 0
        ? 'No analytics, advertising, or tracking SDKs present, and every dependency is on the allowlist.'
        : `${findings.length} dependency violation(s). Either tune the per-language allowlist (see opts.allowlists.flutter / .npm / .python) or remove the dependency.`,
  };
}
