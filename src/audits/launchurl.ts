// AADC Standards 11 (parental controls) + 14 (connected devices).
//
// Outbound-link audit. The rule is:
//
//   - Files inside the declared **parent-area** paths MAY call
//     `launchUrl(...)` with `LaunchMode.externalApplication` (Dart), or
//     open an external origin in a new browser context (web). Those
//     surfaces are post-parent-gate; the parent's own OS browser is
//     the right destination there.
//
//   - Every other Dart file MUST NOT call `launchUrl` at all. Kid-
//     facing surfaces are required to route outbound URLs through a
//     vetted in-app sandboxed WebView, so a child tapping a link
//     never lands in the parent's logged-in OS browser.
//
//   - Every other web file MUST NOT escape the in-app sandbox to an
//     external origin: no window.open(url, '_blank'), no location /
//     location.href / location.assign / location.replace to an external
//     literal URL, and no <a target="_blank"> with an external href.
//     First-party / relative / hash / mailto / tel destinations and
//     framework router navigation are never flagged.
//
// Declare your parent-area paths via opts.allowlists.parentAreaPaths
// (an array of project-relative paths) or AADC_PARENT_AREA_PATHS.
// If you don't declare any, the audit defaults to a safer (and
// noisier) "no external escape anywhere" rule, which is the right
// starting point if you haven't yet split your app into kid vs parent.
//
// Declare your own first-party site host(s) via
// opts.allowlists.firstPartyOrigins or AADC_FIRST_PARTY_ORIGINS so a
// target=_blank / window.open to your own help pages is not flagged.
//
// Comment references are stripped per language before matching.

import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';
import {
  isDartFile,
  isWebFile,
  isMetadataOrGenerated,
  langForFile,
  stripComments,
  classifyUrl,
  hostOf,
  type Lang,
} from './web-source.js';

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

// Web test / story / mock paths are not shipped kid-facing surfaces.
const WEB_SKIP_FRAGMENTS = [
  '/test/', '/tests/', '/__tests__/', '/__mocks__/', '/stories/',
];
const WEB_SKIP_BASENAME_RE = /(\.test\.|\.spec\.|\.stories\.)/;

function isWebTestOrStory(file: string, projectRoot: string): boolean {
  // Match against the path RELATIVE to the project root (with a leading
  // slash) so an ancestor directory named "tests" outside the project
  // (e.g. auditing a fixture under a repo's own tests/ tree) does not
  // make every file self-skip.
  const rel = '/' + normalisePath(relative(projectRoot, file));
  if (WEB_SKIP_FRAGMENTS.some((f) => rel.includes(f))) return true;
  if (WEB_SKIP_BASENAME_RE.test(rel)) return true;
  return false;
}

// Dart branch. lines are already comment-stripped (blanked) via
// stripComments(.., 'dart'), so a launchUrl( reference inside a
// trailing // comment or a /* */ block comment is never matched, just
// like hardcoded-url. A real launchUrl( call still flags.
function dartMatch(
  file: string,
  lines: string[],
  projectRoot: string,
  inParentArea: boolean,
  findings: AuditFinding[],
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/launchUrl\s*\(/.test(line)) continue;
    // Accumulate up to 4 lines of wrapped-arg context.
    const window = lines.slice(i, i + 5).join(' ');
    const hasExternalMode = /LaunchMode\.externalApplication/.test(window);
    const where = `${relative(projectRoot, file)}:${i + 1}`;

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

// Build the web finding message from the design's exact wording.
function webMessage(trigger: string, url: string, host: string, needsNoopener: boolean): string {
  let msg =
    `External navigation out of the in-app sandbox: ${trigger} sends a child to ${url} in the parent's OS browser. ` +
    `Standard 11/14: keep kid-facing outbound links inside a vetted in-app sandbox (a sandboxed WebView or in-app browser component). ` +
    `If this is genuinely a parent-area surface, add its path to opts.allowlists.parentAreaPaths or AADC_PARENT_AREA_PATHS. ` +
    `If ${host} is your own first-party site, declare it in opts.allowlists.firstPartyOrigins or AADC_FIRST_PARTY_ORIGINS.`;
  if (needsNoopener) {
    msg += ` Also add rel="noopener noreferrer" so the external page cannot reach window.opener.`;
  }
  return msg;
}

// Evaluate one complete <a ...> opening tag (as a single joined string)
// for a target=_blank external-href escape, pushing a finding at
// `where` if it matches. Shared by the single-line and multi-line
// anchor passes so they apply identical extraction logic.
function evalAnchorTag(
  tagStr: string,
  where: string,
  firstPartyOrigins: string[],
  findings: AuditFinding[],
): void {
  const hasBlank = /target\s*=\s*(?:(['"])\s*_blank\s*\1|_blank\b|\{\s*(['"`])_blank\2\s*\})/i.test(tagStr);
  if (!hasBlank) return;
  const hrefMatch = /href\s*=\s*(?:(['"])(.*?)\1|\{['"`]([^'"`]+)['"`]\})/i.exec(tagStr);
  if (!hrefMatch) return;
  const href = hrefMatch[2] !== undefined ? hrefMatch[2] : hrefMatch[3];
  if (href === undefined) return;
  if (classifyUrl(href, firstPartyOrigins) !== 'external') return;
  const relMatch = /rel\s*=\s*(['"])(.*?)\1/i.exec(tagStr);
  const relTokens = relMatch ? relMatch[2].toLowerCase().split(/\s+/).filter(Boolean) : [];
  const needsNoopener = !relTokens.includes('noopener');
  findings.push({
    where,
    message: webMessage(`<a target="_blank"> link`, href, hostOf(href), needsNoopener),
    standards: [11, 14],
  });
}

// How many lines a multi-line <a ...> opening tag may span before we
// give up looking for its closing '>'.
const ANCHOR_SPAN_LINES = 12;

// Web branch. lines are already comment-stripped (blanked).
function webMatch(
  file: string,
  lines: string[],
  firstPartyOrigins: string[],
  projectRoot: string,
  findings: AuditFinding[],
): void {
  const anchorTagRe = /<a\b[^>]*>/gi;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const where = `${relative(projectRoot, file)}:${i + 1}`;

    // (1) window.open(url, '_blank') or window.open(url) (no target).
    //     Plus bare open('literal', ...) when the literal is external.
    {
      const winOpen = /\bwindow\.open\s*\(\s*(['"`])([^'"`]*)\1\s*(?:,\s*(['"`])([^'"`]*)\3)?/.exec(line);
      if (winOpen) {
        const arg = winOpen[2];
        const target = winOpen[4];
        const newContext = target === undefined || target === '_blank';
        if (newContext && classifyUrl(arg, firstPartyOrigins) === 'external') {
          findings.push({
            where,
            message: webMessage(`window.open(..., '_blank')`, arg, hostOf(arg), false),
            standards: [11, 14],
          });
        }
      } else {
        // window.open with a non-literal first arg ('unknown'): the
        // new-context escape is the violation. Restricted to the
        // explicit window.open form to avoid unrelated open() methods.
        const winOpenVar = /\bwindow\.open\s*\(\s*[^'"`)\s][^,)]*/.test(line);
        if (winOpenVar) {
          findings.push({
            where,
            message: webMessage(`window.open(..., '_blank')`, 'an external destination', 'that host', false),
            standards: [11, 14],
          });
        }
      }
      // Bare open('https://external...', ...) with a string literal.
      const bareOpen = /(?<![\w.])open\s*\(\s*(['"`])([^'"`]*)\1/.exec(line);
      if (bareOpen && !/\bwindow\.open\s*\(/.test(line)) {
        const arg = bareOpen[2];
        if (classifyUrl(arg, firstPartyOrigins) === 'external') {
          findings.push({
            where,
            message: webMessage(`window.open(..., '_blank')`, arg, hostOf(arg), false),
            standards: [11, 14],
          });
        }
      }
    }

    // (2) location / location.href / location.assign / location.replace
    //     assigned a LITERAL external URL. Non-literal RHS not flagged.
    {
      const locAssign = /\b(?:window\.|document\.|globalThis\.|self\.|top\.|parent\.)?location\s*(?:\.href)?\s*=\s*(['"`])([^'"`]*)\1/.exec(line);
      const locMethod = /\blocation\s*\.\s*(?:assign|replace)\s*\(\s*(['"`])([^'"`]*)\1/.exec(line);
      const locUrl = locAssign ? locAssign[2] : locMethod ? locMethod[2] : null;
      if (locUrl !== null && classifyUrl(locUrl, firstPartyOrigins) === 'external') {
        findings.push({
          where,
          message: webMessage('location navigation', locUrl, hostOf(locUrl), false),
          standards: [11, 14],
        });
      }
    }

    // (3) <a target="_blank"> with an external href (+ noopener note).
    //     First, any anchor tag that opens AND closes on this line
    //     (single-line behaviour, unchanged).
    {
      anchorTagRe.lastIndex = 0;
      let tag;
      while ((tag = anchorTagRe.exec(line)) !== null) {
        evalAnchorTag(tag[0], where, firstPartyOrigins, findings);
      }
    }

    // (3b) Multi-line <a ...> tag: an opening "<a" on this line whose
    //      closing ">" is on a later line (idiomatic in formatted
    //      HTML/JSX). Accumulate from the "<a" up to the first ">"
    //      within a bounded window, join, and run the same extraction.
    //      The finding is cited at the line where "<a" began. We only
    //      enter this when the tag does NOT close on the same line, so
    //      single-line tags (handled above) are never double-counted.
    {
      const openMatch = /<a\b/i.exec(line);
      if (openMatch) {
        const afterOpen = line.slice(openMatch.index);
        if (!afterOpen.includes('>')) {
          let joined = afterOpen;
          let closed = false;
          const end = Math.min(lines.length, i + ANCHOR_SPAN_LINES);
          for (let j = i + 1; j < end; j++) {
            const gtIdx = lines[j].indexOf('>');
            if (gtIdx === -1) {
              joined += ' ' + lines[j];
              continue;
            }
            joined += ' ' + lines[j].slice(0, gtIdx + 1);
            closed = true;
            break;
          }
          if (closed) {
            evalAnchorTag(joined, where, firstPartyOrigins, findings);
          }
        }
      }
    }
  }
}

export async function auditLaunchUrl(opts: AuditOptions): Promise<AuditResult> {
  const parentAreaPaths =
    opts.allowlists?.parentAreaPaths ??
    (opts.options?.parentAreaPaths
      ? opts.options.parentAreaPaths.split(/[\s,]+/).filter(Boolean)
      : []);

  const firstPartyOrigins =
    opts.allowlists?.firstPartyOrigins ??
    (opts.options?.firstPartyOrigins
      ? opts.options.firstPartyOrigins.split(/[\s,]+/).filter(Boolean)
      : []);

  const findings: AuditFinding[] = [];
  let scanned = 0;

  for (const file of walk(opts.projectRoot, {
    filter: (p) => (isDartFile(p) || isWebFile(p)) && !isMetadataOrGenerated(p),
  })) {
    if (isWebFile(file) && isWebTestOrStory(file, opts.projectRoot)) continue;
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    scanned++;
    const inParentArea = isParentArea(file, opts.projectRoot, parentAreaPaths);

    if (isDartFile(file)) {
      // Strip comments first (like hardcoded-url) so a launchUrl(
      // reference inside a // or /* */ comment is documentation, not a
      // call, and is never flagged.
      const dartLines = stripComments(body.split('\n'), 'dart');
      dartMatch(file, dartLines, opts.projectRoot, inParentArea, findings);
    } else {
      // Parent-area web surfaces may legitimately open the parent's OS
      // browser, so they are exempt from the escape findings entirely.
      if (inParentArea) continue;
      const lang: Lang = langForFile(file);
      const lines = stripComments(body.split('\n'), lang);
      webMatch(file, lines, firstPartyOrigins, opts.projectRoot, findings);
    }
  }

  if (scanned === 0) {
    return {
      id: 'launchurl',
      title: 'Outbound-link mode',
      standards: [11, 14],
      severity: 'pass',
      findings: [],
      applicable: false,
      scanned: 0,
      summary:
        'No Dart or web source files found; nothing to audit. Add .dart/.js/.ts/.jsx/.tsx/.html/.vue/.svelte sources, or point the audit at the project root.',
    };
  }

  return {
    id: 'launchurl',
    title: 'Outbound-link mode',
    standards: [11, 14],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    scanned,
    summary:
      findings.length === 0
        ? parentAreaPaths.length > 0
          ? `Outbound external navigation confined to ${parentAreaPaths.length} declared parent-area path(s); kid-facing files clean.`
          : 'No external-navigation escapes found. (No parent-area paths declared, so the audit ran in strictest mode.)'
        : `${findings.length} outbound-escape violation(s); outbound URLs would reach a child via the parent's OS browser.`,
  };
}
