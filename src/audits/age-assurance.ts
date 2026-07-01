// AADC Standard 3 (age appropriate application).
//
// Standard 3 gives two routes to compliance: either (a) establish your
// users' age with a level of certainty appropriate to the risks and
// apply the code's protections to under-18s, OR (b) apply the
// protections to ALL users regardless of age. This audit checks that at
// least one of those routes shows up.
//
// This is a presence heuristic and is WARN-ONLY by design:
//   - signal-ABSENCE is not proof: age assurance may be implemented
//     server-side, in a dependency, or behind names this scan does not
//     recognise; and
//   - signal-PRESENCE is not validation: finding a "date of birth"
//     field does not tell us whether the resulting certainty is
//     appropriate to the risks. That is a judgement-based assessment
//     under Standard 3 which this tool cannot make.
// Declare a blanket apply-to-all-users stance with AADC_AGE_STRATEGY=
// all-users (or opts.options.ageStrategy='all-users') if route (b)
// applies, so this audit can confirm route (b) without scanning.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';

const ID = 'age-assurance';
const TITLE = 'Age-assurance mechanism or all-users stance';
const STANDARDS = [3];

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

// Case-insensitive age-assurance / age-gate signals.
const AGE_SIGNALS: Array<{ re: RegExp; label: string }> = [
  { re: /date[ _-]?of[ _-]?birth|dateOfBirth|\bdob\b/i, label: 'date of birth' },
  { re: /birth[ _-]?year|yearOfBirth/i, label: 'birth year' },
  { re: /age[ _-]?gate|ageGate/i, label: 'age gate' },
  { re: /verifyAge|checkAge|isAdult|isMinor|isUnder/i, label: 'age check' },
  { re: /minimum[ _-]?age|minAge/i, label: 'minimum age' },
  { re: /age[ _-]?verification|ageVerification/i, label: 'age verification' },
  { re: /parental[ _-]?consent|parentalConsent/i, label: 'parental consent' },
];

const MAX_EXAMPLES = 10;

export async function auditAgeAssurance(opts: AuditOptions): Promise<AuditResult> {
  const strategy = opts.options?.ageStrategy;

  if (strategy === 'all-users') {
    return {
      id: ID,
      title: TITLE,
      standards: STANDARDS,
      severity: 'pass',
      findings: [],
      summary:
        'Project declares blanket application of the AADC protections to all users (AADC_AGE_STRATEGY=all-users), which is route (b) of Standard 3. Age assurance is therefore not required.',
    };
  }

  const findings: AuditFinding[] = [];
  let scanned = 0;

  for (const file of walk(opts.projectRoot, {
    filter: (p) => SCAN_EXTENSIONS.some((ext) => p.endsWith(ext)),
  })) {
    let body: string;
    try {
      body = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    scanned++;
    if (findings.length >= MAX_EXAMPLES) continue;
    const lines = body.split('\n');
    for (let i = 0; i < lines.length && findings.length < MAX_EXAMPLES; i++) {
      const line = lines[i];
      for (const { re, label } of AGE_SIGNALS) {
        if (re.test(line)) {
          findings.push({
            where: `${relative(opts.projectRoot, file)}:${i + 1}`,
            message: `Possible age-assurance signal (${label}): "${line.trim().slice(0, 140)}"`,
            standards: STANDARDS,
          });
          break;
        }
      }
    }
  }

  if (findings.length > 0) {
    const examples = findings
      .slice(0, 2)
      .map((f) => f.where)
      .join(', ');
    return {
      id: ID,
      title: TITLE,
      standards: STANDARDS,
      severity: 'pass',
      findings,
      scanned,
      summary:
        `An age-assurance / age-gate mechanism was detected (for example at ${examples}). ` +
        'Note: this audit cannot judge whether the age assurance is sufficiently certain for the risks involved, which is a judgement-based assessment under Standard 3.',
    };
  }

  return {
    id: ID,
    title: TITLE,
    standards: STANDARDS,
    severity: 'warn',
    findings: [
      {
        where: '(project)',
        message:
          'No age-assurance mechanism was detected in code and no apply-to-all-users stance was declared. Under Standard 3 you must do one or the other: either establish users\' age with a certainty appropriate to the risks, or apply the code\'s protections to every user. ' +
          'Set AADC_AGE_STRATEGY=all-users (or opts.options.ageStrategy=\'all-users\') to declare blanket application, or implement age assurance. Signal-absence is not proof: age assurance may live server-side or under names this scan does not recognise.',
        standards: STANDARDS,
      },
    ],
    scanned,
    summary:
      'No age-assurance signals found and no all-users stance declared. Standard 3 requires one route or the other. This check is warn-only: it cannot see server-side or unrecognised implementations.',
  };
}
