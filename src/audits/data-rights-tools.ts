// AADC Standard 15 (online tools).
//
// Standard 15 requires prominent, accessible online tools that let
// children exercise their data protection rights and report concerns.
// This audit scans source for three capabilities: account/data
// deletion (right to erasure), data export/access (right of access and
// portability), and a report/complaint route.
//
// This is a presence heuristic and is WARN-ONLY by design:
//   - a matched string is NOT proof the tool actually works or is
//     prominent and accessible; and
//   - a missing capability does NOT prove it is absent: the tool may be
//     implemented server-side, in a separate web app, or outside the
//     scanned tree.
// Narrow the scan to specific subtrees with AADC_DATA_RIGHTS_PATHS (or
// opts.options.dataRightsPaths), comma- or space-separated, relative to
// the project root.

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';

const ID = 'data-rights-tools';
const TITLE = 'Data-rights and reporting tools present';
const STANDARDS = [15];

const SCAN_EXTENSIONS = [
  '.dart',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.kt',
  '.swift',
  '.py',
  '.vue',
  '.svelte',
  '.md',
];

interface Capability {
  key: string;
  label: string;
  /** What to add when this capability is missing. */
  remedy: string;
  patterns: RegExp[];
}

const CAPABILITIES: Capability[] = [
  {
    key: 'deletion',
    label: 'account / data deletion (right to erasure)',
    remedy:
      'Add a prominent "delete account" / "delete my data" tool so children can exercise the right to erasure.',
    patterns: [
      /delete[ _-]?account/i,
      /deleteAccount/i,
      /delete[ _-]?my[ _-]?data/i,
      /right[ _-]?to[ _-]?erasure/i,
      /\berase\b/i,
      /closeAccount/i,
      /close[ _-]?account/i,
      /\/delete-account/i,
    ],
  },
  {
    key: 'export',
    label: 'data export / access (right of access and portability)',
    remedy:
      'Add a "download my data" / data export tool so children can exercise the right of access and data portability.',
    patterns: [
      /export[ _-]?data/i,
      /exportData/i,
      /download[ _-]?my[ _-]?data/i,
      /downloadData/i,
      /data[ _-]?export/i,
      /subject[ _-]?access/i,
      /access[ _-]?request/i,
      /\/export/i,
    ],
  },
  {
    key: 'report',
    label: 'report / complaint route',
    remedy:
      'Add a prominent "report a concern" / complaint tool so children can raise concerns and report issues.',
    patterns: [
      /report[ _-]?a[ _-]?concern/i,
      /raise[ _-]?a[ _-]?concern/i,
      /complaint/i,
      /\breport\b/i,
      /contact[ _-]?us/i,
      /\/report/i,
    ],
  },
];

function scanRoots(opts: AuditOptions): string[] {
  const raw = opts.options?.dataRightsPaths;
  if (!raw) return [opts.projectRoot];
  const rels = raw.split(/[\s,]+/).filter(Boolean);
  const roots = rels
    .map((r) => join(opts.projectRoot, r))
    .filter((p) => existsSync(p));
  return roots.length > 0 ? roots : [opts.projectRoot];
}

export async function auditDataRightsTools(opts: AuditOptions): Promise<AuditResult> {
  const roots = scanRoots(opts);
  const found = new Set<string>();
  const exampleFor = new Map<string, string>();
  let scanned = 0;

  for (const root of roots) {
    for (const file of walk(root, {
      filter: (p) => SCAN_EXTENSIONS.some((ext) => p.endsWith(ext)),
    })) {
      let body: string;
      try {
        body = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      scanned++;
      for (const cap of CAPABILITIES) {
        if (found.has(cap.key)) continue;
        if (cap.patterns.some((re) => re.test(body))) {
          found.add(cap.key);
          exampleFor.set(cap.key, relative(opts.projectRoot, file));
        }
      }
    }
  }

  if (scanned === 0) {
    return {
      id: ID,
      title: TITLE,
      standards: STANDARDS,
      severity: 'pass',
      findings: [],
      applicable: false,
      scanned: 0,
      summary: 'No source files found to scan for data-rights and reporting tools; nothing to audit.',
    };
  }

  const findings: AuditFinding[] = [];
  for (const cap of CAPABILITIES) {
    if (!found.has(cap.key)) {
      findings.push({
        where: '(project)',
        message:
          `No ${cap.label} tool detected. Standard 15 requires prominent, accessible tools for children to exercise their data rights and report concerns. ${cap.remedy} ` +
          'This is a heuristic: if the tool is server-side or outside the scanned tree, narrow or redirect the scan with AADC_DATA_RIGHTS_PATHS.',
        standards: STANDARDS,
      });
    }
  }

  const foundLabels = CAPABILITIES.filter((c) => found.has(c.key)).map((c) => c.label);
  const missingLabels = CAPABILITIES.filter((c) => !found.has(c.key)).map((c) => c.label);

  if (findings.length === 0) {
    return {
      id: ID,
      title: TITLE,
      standards: STANDARDS,
      severity: 'pass',
      findings,
      scanned,
      summary:
        `All three capabilities detected: ${foundLabels.join('; ')}. A matched string is not proof the tool works or is prominent, but the signals are present.`,
    };
  }

  return {
    id: ID,
    title: TITLE,
    standards: STANDARDS,
    severity: 'warn',
    findings,
    scanned,
    summary:
      `${missingLabels.length} of 3 data-rights/reporting capabilities not detected. Found: ${foundLabels.length > 0 ? foundLabels.join('; ') : 'none'}. Missing: ${missingLabels.join('; ')}. Warn-only: a missing capability may be server-side or outside the scanned tree.`,
  };
}
