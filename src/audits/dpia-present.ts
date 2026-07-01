// AADC Standard 2 (data protection impact assessments).
//
// A DPIA is mandatory for any online service likely to be accessed by
// children. This audit is a presence/process heuristic: it checks that
// a DPIA document exists IN-REPO and that it is not an obvious unfilled
// stub (too short, still full of placeholder markers, or missing the
// core section signals a DPIA should contain).
//
// What it CANNOT see: the substance and quality of the assessment, nor
// a DPIA that lives outside the repository (Confluence, SharePoint, a
// PDF in a compliance system, etc). For that reason absence is only a
// WARN, never a FAIL: a missing in-repo file is not proof that no DPIA
// exists. Point the audit at an alternative location with
// AADC_DPIA_PATH / opts.options.dpiaPath if the document lives
// elsewhere in the tree.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';

const ID = 'dpia-present';
const TITLE = 'DPIA document present and not a stub';
const STANDARDS = [2];

// First candidate that exists wins.
const DEFAULT_CANDIDATES = [
  'docs/regulations/aadc/DPIA.md',
  'docs/DPIA.md',
  'docs/dpia.md',
  'DPIA.md',
];

// Case-insensitive markers that betray an unfilled stub.
const PLACEHOLDER_MARKERS = [
  'lorem ipsum',
  'todo',
  'fixme',
  'tbd',
  '[ ]',
  'xxxxx',
  'fill in',
  'placeholder',
];

// Core DPIA section signals. Each entry is a group of case-insensitive
// substrings; the group counts as present if ANY of its members appears.
const SECTION_SIGNALS: Array<{ label: string; needles: string[] }> = [
  { label: 'risk', needles: ['risk'] },
  { label: 'mitigation', needles: ['mitigat'] },
  { label: 'data flow / processing', needles: ['data flow', 'processing'] },
  { label: 'children / age', needles: ['children', 'age'] },
  { label: 'necessity / proportionality', needles: ['necess', 'proportion'] },
];

export async function auditDpiaPresent(opts: AuditOptions): Promise<AuditResult> {
  const override = opts.options?.dpiaPath;
  const candidates = override ? [override] : DEFAULT_CANDIDATES;

  let foundRel: string | undefined;
  let foundFull: string | undefined;
  for (const rel of candidates) {
    const full = join(opts.projectRoot, rel);
    if (existsSync(full)) {
      foundRel = rel;
      foundFull = full;
      break;
    }
  }

  if (!foundRel || !foundFull) {
    const where = override ?? DEFAULT_CANDIDATES.join(', ');
    return {
      id: ID,
      title: TITLE,
      standards: STANDARDS,
      severity: 'warn',
      findings: [
        {
          where,
          message:
            'No DPIA document found in-repo. Under Standard 2 a DPIA is mandatory for any online service likely to be accessed by children, and it should be completed before launch so its outcomes can influence the design. ' +
            'If a DPIA exists outside this repository (for example in Confluence or a compliance system), point this audit at it with AADC_DPIA_PATH (or opts.options.dpiaPath). Otherwise, create one.',
          standards: STANDARDS,
        },
      ],
      scanned: 0,
      summary: `No DPIA document found at ${where}. Standard 2 requires one; set AADC_DPIA_PATH if it lives elsewhere.`,
    };
  }

  let body: string;
  try {
    body = readFileSync(foundFull, 'utf8');
  } catch {
    // Treat an unreadable file the same as a stub: we found a path but
    // cannot confirm the content.
    return {
      id: ID,
      title: TITLE,
      standards: STANDARDS,
      severity: 'warn',
      findings: [
        {
          where: foundRel,
          message:
            'A DPIA document was found but could not be read, so its completeness cannot be confirmed. Standard 2.',
          standards: STANDARDS,
        },
      ],
      scanned: 1,
      summary: `DPIA found at ${foundRel} but could not be read.`,
    };
  }

  const lowered = body.toLowerCase();
  const nonWhitespaceLen = body.replace(/\s+/g, '').length;
  const findings: AuditFinding[] = [];

  if (nonWhitespaceLen < 400) {
    findings.push({
      where: foundRel,
      message:
        `DPIA document is very short (${nonWhitespaceLen} non-whitespace characters), which suggests an unfilled stub rather than a completed assessment. Standard 2 expects the DPIA to describe the processing, assess necessity and proportionality, identify risks to children and set out mitigations.`,
      standards: STANDARDS,
    });
  }

  const presentMarkers = PLACEHOLDER_MARKERS.filter((m) => lowered.includes(m));
  if (presentMarkers.length > 0) {
    findings.push({
      where: foundRel,
      message:
        `DPIA document still contains placeholder marker(s): ${presentMarkers.join(', ')}. Replace these with the real assessment before relying on it. Standard 2.`,
      standards: STANDARDS,
    });
  }

  const missingSignals = SECTION_SIGNALS.filter(
    (s) => !s.needles.some((n) => lowered.includes(n)),
  );
  if (missingSignals.length >= 2) {
    findings.push({
      where: foundRel,
      message:
        `DPIA document looks incomplete: it is missing the following expected section signal(s): ${missingSignals.map((s) => s.label).join(', ')}. A Standard 2 DPIA should cover the processing/data flows, necessity and proportionality, the risks to children, and the mitigations.`,
      standards: STANDARDS,
    });
  }

  if (findings.length > 0) {
    return {
      id: ID,
      title: TITLE,
      standards: STANDARDS,
      severity: 'warn',
      findings,
      scanned: 1,
      summary: `DPIA found at ${foundRel} but looks like a stub or is incomplete (${findings.length} concern(s) flagged for review).`,
    };
  }

  return {
    id: ID,
    title: TITLE,
    standards: STANDARDS,
    severity: 'pass',
    findings: [],
    scanned: 1,
    summary: `DPIA present at ${foundRel} and contains the expected section signals. This audit checks presence and basic completeness only, not the substance of the assessment.`,
  };
}
