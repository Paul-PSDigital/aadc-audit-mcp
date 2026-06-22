#!/usr/bin/env node
// Dual-mode entrypoint.
//
//   aadc                       → start MCP server on stdio (default, when
//                                  invoked by Claude Code via mcpServers
//                                  config).
//   aadc audit [project-root]  → run every audit, print report, exit 0/1.
//   aadc audit:<id> [root]     → run one audit (permissions, sdks,
//                                  launchurl, network-isolation, defaults,
//                                  reading-grade, placeholders,
//                                  link-reachability, volume-cap,
//                                  sentry-hygiene, hardcoded-url,
//                                  policy-mentions-sdks).
//   aadc standards             → list the 15 AADC standards.
//   aadc help                  → this message.

import { resolve } from 'node:path';
import process from 'node:process';

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

function formatReport(results: AuditResult[]): string {
  const lines: string[] = [];
  lines.push('# AADC audit');
  lines.push('');
  for (const r of results) {
    const mark = r.severity === 'pass' ? 'PASS' : r.severity === 'warn' ? 'WARN' : 'FAIL';
    lines.push(`## ${r.title} — ${mark}`);
    lines.push(`AADC Standard(s): ${r.standards.join(', ')}`);
    lines.push('');
    if (r.findings.length === 0) {
      lines.push(`✓ ${r.summary}`);
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
  return lines.join('\n');
}

async function cmdAudit(id: string | undefined, root: string): Promise<number> {
  const opts: AuditOptions = {
    projectRoot: resolve(root),
    allowlists: effectiveAllowlists(),
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
  return results.some((r) => r.severity === 'fail') ? 1 : 0;
}

function cmdHelp(): void {
  process.stdout.write(
    `aadc-audit-mcp — local AADC compliance audit (stdio MCP server + CLI)

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

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(2);
});
