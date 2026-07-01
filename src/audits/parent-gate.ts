// AADC Standard 11 (parental controls).
//
// Structural check that a parent gate (an age/adult gate protecting the
// parent-only area) both EXISTS in code and is not a trivially
// bypassable one-tap "yes I'm a grown-up" affirmation that a young child
// can pass unaided. It runs only once you have declared your parent-area
// paths (opts.allowlists.parentAreaPaths or AADC_PARENT_AREA_PATHS); with
// none declared it reports N/A rather than guessing.
//
// HONEST LIMITS: this detects PRESENCE plus a best-effort DIFFICULTY
// heuristic only. It cannot verify that the gate actually blocks
// navigation into the parent area (that it is wired up and enforced),
// and gate PERSISTENCE across sessions (whether a passed gate is
// remembered, re-challenged, or trivially re-passable) is runtime
// behaviour that is out of structural reach and remains a manual /
// judgement item. The difficulty heuristic is deliberately conservative:
// it only warns on weakness when it sees a clear trivial-affirm signal
// and no strong-challenge signal, preferring a miss over a false alarm.
// Comment references are stripped per language (Dart/web) before matching.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';
import { isDartFile, isWebFile, langForFile, stripComments } from './web-source.js';
import { resolveParentAreaPaths, isSourceFile } from './parent-area.js';

const ID = 'parent-gate';
const TITLE = 'Parent gate present and non-trivial';
const STANDARDS = [11];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Curated tokens whose presence anywhere indicates a parent/age gate
// mechanism exists. Matched case-insensitively. Callers can add more via
// opts.options.parentGateTokens (comma/space separated).
const GATE_TOKENS = [
  'parentGate', 'parentalGate', 'parental_gate', 'parentalControls',
  'ageGate', 'age_gate', 'adultGate', 'guardianGate',
  'requireAdult', 'verifyAdult', 'AdultOnly',
];

// Phrase regexes for gate copy that would not survive token matching.
const GATE_PHRASE_RES: RegExp[] = [
  /are you (?:a |an )?(?:grown|adult)/i,
  /grown-?up/i,
  /over 18/i,
  /18 or older/i,
  /ask a grown/i,
];

// STRONG-CHALLENGE signals: the gate poses something a young child
// cannot trivially answer (a birth year, an age entry, arithmetic, a
// held gesture, a free-text challenge). Presence anywhere lifts the
// difficulty concern.
const STRONG_CHALLENGE_RES: RegExp[] = [
  /what year/i,
  /year you were born/i,
  /birth year/i,
  /enter your age/i,
  /\bTextField\b/,
  /\bTextInput\b/,
  /\b\d+\s*[+x*]\s*\d+\b/,
  /\bsolve\b/i,
  /type the number/i,
  /hold to\b/i,
];

// TRIVIAL-AFFIRM signals: a weak one-tap / yes-no gate a child can pass.
// Kept deliberately specific so an unrelated "continue" button elsewhere
// does not trip a false alarm: either an explicit affirm phrase, or a tap
// handler on the same line as an affirmative label.
const TRIVIAL_AFFIRM_RES: RegExp[] = [
  /i['’ ]?a?m (?:over ?18|an? adult|a grown[- ]?up)/i,
  /(?:onTap|onPressed|onClick)\b[^\n]{0,80}?\b(?:yes|continue|i['’ ]?a?m (?:an? adult|a grown|over ?18))\b/i,
];

function buildGateRes(opts: AuditOptions): RegExp[] {
  const tokens = [...GATE_TOKENS];
  const extra = opts.options?.parentGateTokens;
  if (extra) {
    for (const t of extra.split(/[\s,]+/).filter(Boolean)) tokens.push(t);
  }
  const tokenRe = new RegExp(`(?:${tokens.map(escapeRegExp).join('|')})`, 'i');
  return [tokenRe, ...GATE_PHRASE_RES];
}

// Comment-stripped lines for Dart/web; raw lines for kt/swift/py (which
// stripComments does not model, so we match the raw text there).
function linesFor(file: string, body: string): string[] {
  if (isDartFile(file) || isWebFile(file)) {
    return stripComments(body.split('\n'), langForFile(file));
  }
  return body.split('\n');
}

export async function auditParentGate(opts: AuditOptions): Promise<AuditResult> {
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

  const gateRes = buildGateRes(opts);
  let scanned = 0;
  let gateWhere: string | null = null;
  let strongFound = false;
  let trivialWhere: string | null = null;

  for (const file of walk(opts.projectRoot, { filter: isSourceFile })) {
    let body: string;
    try {
      body = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    scanned++;
    const lines = linesFor(file, body);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const where = `${relative(opts.projectRoot, file)}:${i + 1}`;
      if (gateWhere === null && gateRes.some((re) => re.test(line))) {
        gateWhere = where;
      }
      if (!strongFound && STRONG_CHALLENGE_RES.some((re) => re.test(line))) {
        strongFound = true;
      }
      if (trivialWhere === null && TRIVIAL_AFFIRM_RES.some((re) => re.test(line))) {
        trivialWhere = where;
      }
    }
  }

  // No gate mechanism detected at all, despite declared parent-only
  // surfaces: a gate is expected before those surfaces under Standard 11.
  if (gateWhere === null) {
    return {
      id: ID,
      title: TITLE,
      standards: STANDARDS,
      severity: 'warn',
      findings: [
        {
          where: '(project)',
          message:
            'Parent-area paths are declared but no parent-gate mechanism was detected anywhere in code. Standard 11 expects a gate before parent-only surfaces so a child cannot reach parental-control settings on their own. If a gate exists under a name this heuristic does not recognise, add its token(s) via opts.options.parentGateTokens.',
          standards: STANDARDS,
        },
      ],
      scanned,
      summary:
        'No parent-gate mechanism detected despite declared parent-area paths. Warn-only: this checks presence and a best-effort difficulty heuristic; it cannot confirm a gate actually blocks navigation, and gate persistence across sessions is out of structural reach.',
    };
  }

  // A gate exists but shows only a trivially-bypassable affirm and no
  // strong challenge. Be conservative: only warn when a clear
  // trivial-affirm signal is present, never on difficulty when uncertain.
  if (!strongFound && trivialWhere !== null) {
    return {
      id: ID,
      title: TITLE,
      standards: STANDARDS,
      severity: 'warn',
      findings: [
        {
          where: trivialWhere,
          message:
            'The parent gate appears trivially bypassable (a single tap / yes-no affirmation), which a young child can pass unaided. Standard 11 expects a gate a child cannot easily pass, for example a birth-year, age-entry, or simple arithmetic challenge rather than a one-tap "I am a grown-up".',
          standards: STANDARDS,
        },
      ],
      scanned,
      summary:
        'A parent gate was detected but looks trivially bypassable (one-tap / yes-no) with no strong challenge. Warn-only heuristic: presence plus a best-effort difficulty check only; it cannot confirm the gate blocks navigation, and gate persistence across sessions is out of structural reach.',
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
      `Parent-gate mechanism detected (first at ${gateWhere})${strongFound ? ' with a non-trivial challenge signal' : ''}. Presence and difficulty are heuristic only: this cannot confirm the gate actually blocks navigation, and gate persistence across sessions remains a manual judgement item.`,
  };
}
