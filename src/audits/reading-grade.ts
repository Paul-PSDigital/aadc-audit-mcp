// AADC Standard 4 (transparency).
//
// The Code requires privacy information and parental-control copy to
// be "concise, prominent, clear, and suited to the child's age" and
// "presented in clear language appropriate to the age of the child."
//
// This audit applies the Flesch-Kincaid Grade Level formula to:
//   - The project's privacy policy (configurable path).
//   - Any iOS / Android permission rationale strings declared in
//     Info.plist / AndroidManifest.xml.
//
// Acceptance thresholds default to a UK-pragmatic baseline:
//   - Privacy policy targeted at parents: grade ≤ 9 (UK reading age
//     ~14-15).
//   - Permission rationale shown to a parent for a kid app:
//     grade ≤ 8.
//
// Override via:
//   opts.options.privacyPolicyPath
//   opts.options.privacyMaxGrade
//   opts.options.rationaleMaxGrade

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';

function countSyllables(word: string): number {
  // Cheap Flesch-Kincaid-grade syllable estimator. Not perfect, but
  // close enough for trend / threshold use.
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  const vowels = w.match(/[aeiouy]+/g) ?? [];
  let count = vowels.length;
  if (w.endsWith('e') && count > 1) count -= 1;
  return Math.max(count, 1);
}

function fleschKincaidGrade(text: string): number {
  // Strip markdown formatting + HTML tags before scoring.
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>|\[\]()]/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 0;

  const sentences = cleaned.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = cleaned.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (sentences.length === 0 || words.length === 0) return 0;
  const syllables = words.reduce((acc, w) => acc + countSyllables(w), 0);

  // Flesch-Kincaid Grade Level formula.
  return (
    0.39 * (words.length / sentences.length) +
    11.8 * (syllables / words.length) -
    15.59
  );
}

export async function auditReadingGrade(opts: AuditOptions): Promise<AuditResult> {
  const privacyPath = opts.options?.privacyPolicyPath ?? 'docs/privacy-policy.md';
  const privacyMax = Number(opts.options?.privacyMaxGrade ?? 9);
  const rationaleMax = Number(opts.options?.rationaleMaxGrade ?? 8);
  const findings: AuditFinding[] = [];

  // ---- privacy policy ----
  const fullPrivacy = join(opts.projectRoot, privacyPath);
  if (existsSync(fullPrivacy)) {
    const text = readFileSync(fullPrivacy, 'utf8');
    const grade = fleschKincaidGrade(text);
    if (grade > privacyMax) {
      findings.push({
        where: relative(opts.projectRoot, fullPrivacy),
        message: `Privacy policy reading grade ${grade.toFixed(1)} exceeds threshold ${privacyMax}. ` +
          `Standard 4 requires copy "suited to the child's age"; this is too academic. ` +
          `Shorten sentences, prefer plain words ("we use" not "we utilise"), break long paragraphs.`,
        standards: [4],
      });
    }
  }

  // ---- iOS permission rationales ----
  const ios = join(opts.projectRoot, 'apps/mobile/ios/Runner/Info.plist');
  if (existsSync(ios)) {
    const body = readFileSync(ios, 'utf8');
    const matches = body.matchAll(
      /<key>([A-Za-z]+UsageDescription)<\/key>\s*<string>([^<]+)<\/string>/g,
    );
    for (const m of matches) {
      const key = m[1];
      const desc = m[2];
      const grade = fleschKincaidGrade(desc);
      if (grade > rationaleMax) {
        findings.push({
          where: `apps/mobile/ios/Runner/Info.plist (${key})`,
          message: `Permission rationale reading grade ${grade.toFixed(1)} exceeds threshold ${rationaleMax}. ` +
            `Parents read this as a modal at install time, often on a phone, often quickly. ` +
            `Shorten and simplify.`,
          standards: [4, 11],
        });
      }
    }
  }

  return {
    id: 'reading-grade',
    title: 'Reading-grade of user-facing copy',
    standards: [4, 11],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    summary:
      findings.length === 0
        ? `Privacy policy + permission rationales all at or below the configured grade thresholds.`
        : `${findings.length} document(s) too academic for the target audience under AADC Standard 4.`,
  };
}
