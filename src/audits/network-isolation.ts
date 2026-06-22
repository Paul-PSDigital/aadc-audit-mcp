// AADC Standard 8 (data minimisation).
//
// Some code paths must never network — a kids' app capturing microphone
// audio must not upload it, an on-device scoring engine must not phone
// home. This audit fails if any file inside a declared protected path
// imports a network-bearing API.
//
// Set opts.options.protectedPaths to a comma-separated list (or pass
// opts.allowlists.protectedPaths as an array).

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';

const DEFAULT_FORBIDDEN = [
  /package:http\//,
  /package:dio\//,
  /dart:io.*HttpClient/,
  /Sentry\.capture/,
  /FirebaseCrashlytics/,
  /http\.post\s*\(/,
  /http\.get\s*\(/,
  /URLSession/,
  /URLRequest/,
  /HttpURLConnection/,
  /java\.net\.URL/,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /axios/,
  /node-fetch/,
  /\bgot\s*[(.\.]/,
  /urllib/,
  /requests\./,
  /reqwest::/,
  /net\/http/,
];

function readableFiles(target: string): string[] {
  if (!existsSync(target)) return [];
  const st = statSync(target);
  if (st.isFile()) return [target];
  // Directory: walk it.
  const out: string[] = [];
  for (const f of walk(target)) out.push(f);
  return out;
}

export async function auditNetworkIsolation(opts: AuditOptions): Promise<AuditResult> {
  const protectedPathsRaw =
    opts.allowlists?.protectedPaths?.join(' ') ??
    opts.options?.protectedPaths ??
    '';
  const protectedPaths = protectedPathsRaw
    .split(/[\s,]+/)
    .filter((p) => p.length > 0)
    .map((p) => (p.startsWith('/') ? p : join(opts.projectRoot, p)));

  const findings: AuditFinding[] = [];

  if (protectedPaths.length === 0) {
    return {
      id: 'network-isolation',
      title: 'Network isolation in must-not-network paths',
      standards: [8],
      severity: 'warn',
      findings: [],
      summary:
        'SKIPPED — set opts.options.protectedPaths (or AADC_PROTECTED_PATHS env) to enable. ' +
        'Without protected paths declared this audit is a no-op.',
    };
  }

  const forbidden = DEFAULT_FORBIDDEN;
  for (const target of protectedPaths) {
    for (const file of readableFiles(target)) {
      let body: string;
      try { body = readFileSync(file, 'utf8'); } catch { continue; }
      const lines = body.split('\n');
      for (let i = 0; i < lines.length; i++) {
        for (const rx of forbidden) {
          if (rx.test(lines[i])) {
            findings.push({
              where: `${relative(opts.projectRoot, file)}:${i + 1}`,
              message: `Network API call inside protected path: matched ${rx}`,
              standards: [8],
            });
            break;
          }
        }
      }
    }
  }

  return {
    id: 'network-isolation',
    title: 'Network isolation in must-not-network paths',
    standards: [8],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    summary:
      findings.length === 0
        ? `${protectedPaths.length} protected path(s) confirmed network-free.`
        : `${findings.length} forbidden network call(s) inside protected paths. Move the call to a non-protected module or expand the conformance statement justification.`,
  };
}
