// Shared parent-area helpers for the Standard 11 (parental controls)
// structural audits. launchurl.ts pioneered parent-area path resolution
// with private copies of normalisePath()/isParentArea(); the parent-gate
// and parent-gate-routes audits need the exact same logic, so it lives
// here once rather than being duplicated three ways.
//
// A "parent-area" path is a project-relative directory (or file) the
// caller declares as a post-parent-gate, parent-only surface. Declare
// them via opts.allowlists.parentAreaPaths or AADC_PARENT_AREA_PATHS.

import { relative, sep } from 'node:path';
import type { AuditOptions } from './types.js';
import { isDartFile, isWebFile, isMetadataOrGenerated } from './web-source.js';

// Normalise OS path separators to '/', so parent-area comparisons are
// stable across platforms. Same behaviour as launchurl's private copy.
export function normalisePath(p: string): string {
  return p.split(sep).join('/');
}

// Resolve the declared parent-area paths from the audit options,
// mirroring launchurl's resolution exactly: an explicit allowlist array
// wins, otherwise split the string option on whitespace/commas, else [].
export function resolveParentAreaPaths(opts: AuditOptions): string[] {
  return (
    opts.allowlists?.parentAreaPaths ??
    (opts.options?.parentAreaPaths
      ? opts.options.parentAreaPaths.split(/[\s,]+/).filter(Boolean)
      : [])
  );
}

// Is filePath inside one of the declared parent-area paths? Same
// behaviour as launchurl's private copy: exact match or a path-segment
// prefix match against the project-relative path. Empty paths => false.
export function isParentArea(filePath: string, projectRoot: string, paths: string[]): boolean {
  if (paths.length === 0) return false;
  const rel = normalisePath(relative(projectRoot, filePath));
  for (const raw of paths) {
    const target = normalisePath(raw).replace(/^\/+/, '');
    if (rel === target) return true;
    if (rel.startsWith(target + '/')) return true;
  }
  return false;
}

// Extra source extensions the structural Standard 11 audits scan on top
// of Dart + web. These are the common native/companion surfaces a parent
// gate might live in.
const EXTRA_SOURCE_EXTS = ['.kt', '.swift', '.py'];

// A source file the parent-gate audits should scan: Dart or web (reusing
// web-source's predicates) or a Kotlin/Swift/Python file, but never a
// metadata/generated file (lockfiles, minified bundles, build output).
export function isSourceFile(p: string): boolean {
  if (isMetadataOrGenerated(p)) return false;
  return isDartFile(p) || isWebFile(p) || EXTRA_SOURCE_EXTS.some((ext) => p.endsWith(ext));
}
