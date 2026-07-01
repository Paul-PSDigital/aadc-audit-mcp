#!/usr/bin/env node
// Dual-mode entrypoint.
//
//   aadc                       -> start MCP server on stdio (default, when
//                                  invoked by Claude Code via mcpServers
//                                  config).
//   aadc audit [project-root]  -> run every audit, print report, exit 0/1.
//   aadc audit:<id> [root]     -> run one audit (permissions, sdks,
//                                  launchurl, network-isolation, defaults,
//                                  reading-grade, placeholders,
//                                  link-reachability, volume-cap,
//                                  sentry-hygiene, hardcoded-url,
//                                  policy-mentions-sdks, dpia-present,
//                                  age-assurance, data-rights-tools).
//   aadc standards             -> list the 15 AADC standards.
//   aadc help                  -> this message.

import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { AUDITS, runAll } from './audits/index.js';
import type { AuditOptions, AuditResult } from './audits/index.js';
import { startMcpServer } from './server.js';
import { readStandardSummaries } from './standards.js';

function envAllowlists(): AuditOptions['allowlists'] {
  const split = (s: string | undefined): string[] | undefined =>
    s ? s.split(/[\s,]+/).filter(Boolean) : undefined;
  return {
    ios: split(process.env.AADC_PERM_ALLOWLIST_IOS) ?? [],
    android: split(process.env.AADC_PERM_ALLOWLIST_ANDROID) ?? [],
    flutter: split(process.env.AADC_SDK_ALLOWLIST_FLUTTER) ?? [],
    npm: split(process.env.AADC_SDK_ALLOWLIST_NPM) ?? [],
    python: split(process.env.AADC_SDK_ALLOWLIST_PYTHON) ?? [],
    protectedPaths: split(process.env.AADC_PROTECTED_PATHS) ?? [],
    parentAreaPaths: split(process.env.AADC_PARENT_AREA_PATHS) ?? [],
    trustedHosts: split(process.env.AADC_TRUSTED_HOSTS) ?? [],
    firstPartyOrigins: split(process.env.AADC_FIRST_PARTY_ORIGINS) ?? [],
  };
}

// Drop allowlists that the user didn't set so the audit modules fall
// back to their built-in defaults.
function effectiveAllowlists(): AuditOptions['allowlists'] {
  const raw = envAllowlists()!;
  const out: NonNullable<AuditOptions['allowlists']> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v && v.length > 0) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// Build per-audit string overrides from env. Only include keys whose
// env var is set, so each audit falls back to its built-in default.
// Returns undefined when none are set.
function effectiveOptions(): AuditOptions['options'] {
  const out: Record<string, string> = {};
  const map: Array<[string, string]> = [
    ['AADC_DPIA_PATH', 'dpiaPath'],
    ['AADC_AGE_STRATEGY', 'ageStrategy'],
    ['AADC_DATA_RIGHTS_PATHS', 'dataRightsPaths'],
    ['AADC_PRIVACY_POLICY_PATH', 'privacyPolicyPath'],
  ];
  for (const [envVar, key] of map) {
    const v = process.env[envVar];
    if (v) out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function formatReport(results: AuditResult[]): string {
  const lines: string[] = [];
  lines.push('# AADC audit');
  lines.push('');
  for (const r of results) {
    const naFlag = r.applicable === false;
    const mark = naFlag
      ? 'N/A'
      : r.severity === 'pass'
        ? 'PASS'
        : r.severity === 'warn'
          ? 'WARN'
          : 'FAIL';
    const scannedSuffix = typeof r.scanned === 'number' ? ` (scanned ${r.scanned})` : '';
    if (naFlag) {
      // Distinct N/A heading so a not-applicable audit never reads as a
      // green pass.
      lines.push(`## ${r.title} - [N/A]${scannedSuffix}`);
    } else {
      lines.push(`## ${r.title} - ${mark}${scannedSuffix}`);
    }
    lines.push(`AADC Standard(s): ${r.standards.join(', ')}`);
    lines.push('');
    if (r.findings.length === 0) {
      // Neutral marker for N/A; the green check only for a real pass.
      lines.push(naFlag ? `- ${r.summary}` : `✓ ${r.summary}`);
    } else {
      for (const f of r.findings) {
        lines.push(`  - ${f.where}: ${f.message}`);
      }
      lines.push('');
      lines.push(r.summary);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Tally. Classification keys off applicable===false FIRST so a
  // not-applicable audit is never counted as passed or as a warning. The
  // four counts always sum to results.length.
  const passed = results.filter((r) => r.severity === 'pass' && r.applicable !== false).length;
  const warnings = results.filter((r) => r.severity === 'warn' && r.applicable !== false).length;
  const failed = results.filter((r) => r.severity === 'fail' && r.applicable !== false).length;
  const notApplicable = results.filter((r) => r.applicable === false).length;
  lines.push(`${passed} passed, ${warnings} warnings, ${failed} failed, ${notApplicable} not applicable`);
  lines.push('');

  return lines.join('\n');
}

async function cmdAudit(id: string | undefined, root: string): Promise<number> {
  const opts: AuditOptions = {
    projectRoot: resolve(root),
    allowlists: effectiveAllowlists(),
    options: effectiveOptions(),
  };
  let results: AuditResult[];
  if (!id) {
    results = await runAll(opts);
  } else {
    const fn = AUDITS[id];
    if (!fn) {
      process.stderr.write(`Unknown audit: ${id}\nAvailable: ${Object.keys(AUDITS).join(', ')}\n`);
      return 2;
    }
    results = [await fn(opts)];
  }
  process.stdout.write(formatReport(results));
  return results.some((r) => r.severity === 'fail' && r.applicable !== false) ? 1 : 0;
}

function cmdHelp(): void {
  process.stdout.write(
    `aadc-audit-mcp: local AADC compliance audit (stdio MCP server + CLI)

Usage:
  aadc                       Start MCP server on stdio (default).
  aadc audit [root]          Run every audit; print report; exit 0/1.
  aadc audit:permissions [root]
  aadc audit:sdks [root]
  aadc audit:launchurl [root]
  aadc audit:network-isolation [root]
  aadc audit:defaults [root]
  aadc audit:reading-grade [root]
  aadc audit:placeholders [root]
  aadc audit:link-reachability [root]
  aadc audit:volume-cap [root]
  aadc audit:sentry-hygiene [root]
  aadc audit:hardcoded-url [root]
  aadc audit:policy-mentions-sdks [root]
  aadc audit:dpia-present [root]
  aadc audit:age-assurance [root]
  aadc audit:data-rights-tools [root]
  aadc standards             List the 15 AADC standards.
  aadc help                  This message.

Env overrides (per-language allowlists, space- or comma-separated):
  AADC_PERM_ALLOWLIST_IOS
  AADC_PERM_ALLOWLIST_ANDROID
  AADC_SDK_ALLOWLIST_FLUTTER
  AADC_SDK_ALLOWLIST_NPM
  AADC_SDK_ALLOWLIST_PYTHON
  AADC_PROTECTED_PATHS
  AADC_PARENT_AREA_PATHS
  AADC_TRUSTED_HOSTS         (link-reachability: host suffixes to probe)
  AADC_FIRST_PARTY_ORIGINS   (launchurl: origins treated as first-party)
  AADC_CHECK_LINKS=1         (link-reachability: enable outbound HTTP probes)
  AADC_DPIA_PATH             (dpia-present: path to the DPIA document)
  AADC_AGE_STRATEGY          (age-assurance: set to all-users to declare blanket application)
  AADC_DATA_RIGHTS_PATHS     (data-rights-tools: subtrees to scan, space- or comma-separated)
  AADC_PRIVACY_POLICY_PATH   (policy-mentions-sdks: path to the privacy policy)

This tool runs entirely on your machine. Your source code never
leaves the device.
`,
  );
}

async function cmdStandards(): Promise<void> {
  const summaries = await readStandardSummaries();
  for (const s of summaries) {
    process.stdout.write(`${s.number}. ${s.title}\n   ${s.summary}\n\n`);
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);

  if (!cmd) {
    // Default mode: stdio MCP server.
    await startMcpServer();
    return;
  }

  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    cmdHelp();
    return;
  }

  if (cmd === 'standards') {
    await cmdStandards();
    return;
  }

  if (cmd === 'audit') {
    process.exit(await cmdAudit(undefined, rest[0] ?? '.'));
  }

  if (cmd.startsWith('audit:')) {
    const id = cmd.slice('audit:'.length);
    process.exit(await cmdAudit(id, rest[0] ?? '.'));
  }

  process.stderr.write(`Unknown command: ${cmd}\nRun "aadc help" for usage.\n`);
  process.exit(2);
}

// Only run when invoked as the program entrypoint. Importing this module
// (e.g. from tests to reach formatReport) must not start the server or
// parse argv.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    process.stderr.write(`${err?.stack ?? err}\n`);
    process.exit(2);
  });
}
