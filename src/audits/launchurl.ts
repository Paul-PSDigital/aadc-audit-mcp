// AADC Standards 11 (parental controls) + 14 (connected devices).
//
// Outbound-link audit. The rule is:
//
//   - Files inside the declared **parent-area** paths MAY call
//     `launchUrl(...)` with `LaunchMode.externalApplication`. Those
//     surfaces are post-parent-gate; the parent's own OS browser is
//     the right destination there.
//
//   - Every other Dart file MUST NOT call `launchUrl` at all. Kid-
//     facing surfaces are required to route outbound URLs through a
//     vetted in-app sandboxed WebView, so a child tapping a link
//     never lands in the parent's logged-in OS browser.
//
// Declare your parent-area paths via opts.allowlists.parentAreaPaths
// (an array of project-relative paths) or AADC_PARENT_AREA_PATHS.
// If you don't declare any, the audit defaults to a safer (and
// noisier) "no launchUrl anywhere" rule — which is the right starting
// point if you haven't yet split your app into kid vs parent.
//
// Comment-only references (`// launchUrl(...)`) are skipped.

import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';

function normalisePath(p: string): string {
  return p.split(sep).join('/');
}

function isParentArea(filePath: string, projectRoot: string, paths: string[]): boolean {
  if (paths.length === 0) return false;
  const rel = normalisePath(relative(projectRoot, filePath));
  for (const raw of paths) {
    const target = normalisePath(raw).replace(/^\/+/, '');
    if (rel === target) return true;
    if (rel.startsWith(target + '/')) return true;
  }
  return false;
}

export async function auditLaunchUrl(opts: AuditOptions): Promise<AuditResult> {
  const parentAreaPaths =
    opts.allowlists?.parentAreaPaths ??
    (opts.options?.parentAreaPaths
      ? opts.options.parentAreaPaths.split(/[\s,]+/).filter(Boolean)
      : []);

  const findings: AuditFinding[] = [];

  for (const file of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('.dart'),
  })) {
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = body.split('\n');
    const inParentArea = isParentArea(file, opts.projectRoot, parentAreaPaths);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/launchUrl\s*\(/.test(line)) continue;
      // Skip Dart line-comment references — they're documentation, not calls.
      if (/^\s*\/\//.test(line)) continue;
      // Accumulate up to 4 lines of wrapped-arg context.
      const window = lines.slice(i, i + 5).join(' ');
      const hasExternalMode = /LaunchMode\.externalApplication/.test(window);
      const where = `${relative(opts.projectRoot, file)}:${i + 1}`;

      if (inParentArea) {
        // Parent-area surfaces: must explicitly use externalApplication
        // so we don't accidentally fall back to an in-app WebView.
        if (!hasExternalMode) {
          findings.push({
            where,
            message:
              'launchUrl in parent-area file without LaunchMode.externalApplication. Either set the mode explicitly or route through the safe-link helper.',
            standards: [11, 14],
          });
        }
      } else {
        // Kid-facing (or undeclared) surface: launchUrl is forbidden
        // entirely. Even externalApplication mode sends a child into
        // the parent's logged-in OS browser. Route through the in-app
        // sandboxed WebView helper instead.
        const hint = hasExternalMode
          ? 'externalApplication mode dumps a child into the parent\'s OS browser.'
          : 'launchUrl is forbidden in kid-facing files regardless of mode.';
        findings.push({
          where,
          message:
            `${hint} Route through the in-app sandboxed WebView helper (e.g. openSafeKidFacingLink) instead. If this file IS parent-area, add its path to opts.allowlists.parentAreaPaths or AADC_PARENT_AREA_PATHS.`,
          standards: [11, 14],
        });
      }
    }
  }

  return {
    id: 'launchurl',
    title: 'Outbound-link mode',
    standards: [11, 14],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    summary:
      findings.length === 0
        ? parentAreaPaths.length > 0
          ? `launchUrl confined to ${parentAreaPaths.length} declared parent-area path(s); kid-facing files clean.`
          : 'No launchUrl calls found. (No parent-area paths declared, so the audit ran in strictest mode.)'
        : `${findings.length} launchUrl violation(s) — outbound URLs would reach a child via the parent's OS browser.`,
  };
}
