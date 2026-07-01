// AADC Standard 11 (parental controls).
//
// Structural check that every declared parent-area source file actually
// references a gate or a route-guard, so a parent-only surface cannot be
// reached directly (via a deep link or a direct route) without passing
// the parent gate. It runs only once you have declared your parent-area
// paths (opts.allowlists.parentAreaPaths or AADC_PARENT_AREA_PATHS); with
// none declared it reports N/A rather than guessing.
//
// HONEST LIMITS: this is a warn-only heuristic. A referenced guard token
// is NOT proof the guard is wired correctly (that it truly blocks entry).
// Conversely, its absence in a given file can be a FALSE POSITIVE when
// the gate is applied centrally by a parent router or layout file rather
// than inline in each surface. Treat findings as prompts to confirm the
// route protection by hand, not as proof of a hole.
// Comment references are stripped per language (Dart/web) before matching.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';
import { isDartFile, isWebFile, langForFile, stripComments } from './web-source.js';
import { resolveParentAreaPaths, isParentArea, isSourceFile } from './parent-area.js';

const ID = 'parent-gate-routes';
const TITLE = 'Parent-area routes reference a gate or guard';
const STANDARDS = [11];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Gate tokens (the parent/age-gate mechanism itself) plus framework
// route-guard tokens. A parent-area file that references any of these is
// treated as gate-protected. Matched case-insensitively. Callers can add
// more via opts.options.parentGuardTokens (comma/space separated).
const GATE_TOKENS = [
  'parentGate', 'parentalGate', 'parental_gate', 'parentalControls',
  'ageGate', 'age_gate', 'adultGate', 'guardianGate',
  'requireAdult', 'verifyAdult', 'AdultOnly',
];

const GUARD_TOKENS = [
  'canActivate', 'beforeEnter', 'routeGuard', 'AuthGuard',
  'requireAuth', 'requireGate', 'guard(', 'redirectTo', 'onlyIf', 'gate',
];

// Gate copy that would not survive token matching but still evidences a
// gate reference in the file.
const GATE_PHRASE_RES: RegExp[] = [
  /are you (?:a |an )?(?:grown|adult)/i,
  /grown-?up/i,
  /over 18/i,
  /18 or older/i,
  /ask a grown/i,
];

function buildGuardRes(opts: AuditOptions): RegExp[] {
  const tokens = [...GATE_TOKENS, ...GUARD_TOKENS];
  const extra = opts.options?.parentGuardTokens;
  if (extra) {
    for (const t of extra.split(/[\s,]+/).filter(Boolean)) tokens.push(t);
  }
  const tokenRe = new RegExp(`(?:${tokens.map(escapeRegExp).join('|')})`, 'i');
  return [tokenRe, ...GATE_PHRASE_RES];
}

// Comment-stripped lines for Dart/web; raw text for kt/swift/py.
function textFor(file: string, body: string): string {
  if (isDartFile(file) || isWebFile(file)) {
    return stripComments(body.split('\n'), langForFile(file)).join('\n');
  }
  return body;
}

export async function auditParentGateRoutes(opts: AuditOptions): Promise<AuditResult> {
  const parentAreaPaths = resolveParentAreaPaths(opts);

  if (parentAreaPaths.length === 0) {
    return {
      id: ID,
      title: TITLE,
      standards: STANDARDS,
      severity: 'pass',
      findings: [],
      applicable: false,
      scanned: 0,
      summary:
        'Standard 11 structural checks need you to declare your parent-area paths (the parent-only surfaces behind the gate) via AADC_PARENT_AREA_PATHS or opts.allowlists.parentAreaPaths. None were declared, so this audit was skipped.',
    };
  }

  const guardRes = buildGuardRes(opts);
  const findings: AuditFinding[] = [];
  let scanned = 0;

  for (const file of walk(opts.projectRoot, { filter: isSourceFile })) {
    if (!isParentArea(file, opts.projectRoot, parentAreaPaths)) continue;
    let body: string;
    try {
      body = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    scanned++;
    const text = textFor(file, body);
    if (!guardRes.some((re) => re.test(text))) {
      findings.push({
        where: relative(opts.projectRoot, file),
        message:
          'This declared parent-area surface does not reference any parent gate or route-guard, so it may be reachable directly (via a deep link or a direct route) without passing the parent gate. Standard 11. This can be a false positive if the gate is applied centrally by a parent router or layout file rather than inline; confirm the route is protected. Add guard token(s) this heuristic does not recognise via opts.options.parentGuardTokens.',
        standards: STANDARDS,
      });
    }
  }

  // Declared paths matched no source files on disk: likely a misconfigured
  // path. Nothing to assert, so N/A rather than a misleading pass.
  if (scanned === 0) {
    return {
      id: ID,
      title: TITLE,
      standards: STANDARDS,
      severity: 'pass',
      findings: [],
      applicable: false,
      scanned: 0,
      summary:
        'The declared parent-area paths matched no source files on disk (likely a misconfigured path). Check AADC_PARENT_AREA_PATHS / opts.allowlists.parentAreaPaths point at real parent-only source directories.',
    };
  }

  if (findings.length > 0) {
    return {
      id: ID,
      title: TITLE,
      standards: STANDARDS,
      severity: 'warn',
      findings,
      scanned,
      summary:
        `${findings.length} of ${scanned} declared parent-area file(s) reference no gate or route-guard, so they may be reachable directly without passing the parent gate. Warn-only heuristic: a referenced guard token is not proof it is wired correctly, and an absent one can be a false positive if the gate is applied by a parent router or layout file.`,
    };
  }

  return {
    id: ID,
    title: TITLE,
    standards: STANDARDS,
    severity: 'pass',
    findings: [],
    scanned,
    summary:
      `All ${scanned} declared parent-area file(s) reference a gate or route-guard. Warn-only heuristic: a referenced guard token is not proof it is wired correctly; confirm the route protection actually blocks entry.`,
  };
}
