// AADC Standard 1 (best interests of the child) + Standard 14
// (connected toys and devices).
//
// Kids' audio apps need an explicit volume cap on every player
// instance. WHO Make Listening Safe puts the recommended ceiling for
// children at 75 dB SPL sustained. A player created without a
// setVolume call defaults to 1.0 (no attenuation), which means OS
// volume x content volume goes unbounded at the eardrum / kit
// transducer.
//
// Dart files are scanned for any AudioPlayer() / VideoPlayerController
// construction that isn't followed by a setVolume(...) call within the
// next 30 lines of the same file.
//
// Web files (.js/.mjs/.cjs/.jsx/.ts/.tsx/.html/.htm/.vue/.svelte) are
// scanned for HTMLMediaElement playback surfaces: new Audio(),
// document.createElement('audio'|'video'), and <audio>/<video> markup
// that lack an explicit .volume clamp (a .volume = <0..1> assignment or
// a volume="0.x" attribute) within a 30-line window. A muted attribute
// or .muted assignment is NEVER a clamp, because volume stays at 1.0
// once unmuted. Library wrappers (howler Howl, tone Tone.Player, Web
// Audio AudioContext/AudioBuffer) are deliberately never flagged.
//
// The volumeCapExempt allowlist (default ['/test/']) governs both
// languages. Standards [1, 14].

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';
import {
  isDartFile,
  isWebFile,
  isMetadataOrGenerated,
  langForFile,
  stripComments,
  type Lang,
} from './web-source.js';

const CONSTRUCTORS = [
  /\bAudioPlayer\s*\(\s*\)/,
  /\bVideoPlayerController\.networkUrl\s*\(/,
  /\bVideoPlayerController\.file\s*\(/,
  /\bVideoPlayerController\.asset\s*\(/,
];

const VOLUME_CALL = /\.setVolume\s*\(/;

// Web HTMLMediaElement construction surfaces.
const NEW_AUDIO = /\bnew\s+Audio\s*\(/;
const CREATE_EL = /\.\s*createElement\s*\(\s*(['"`])(audio|video)\1/i;
// (?![\w-]) instead of \b so hyphenated custom elements like
// <video-card> / <audio-player> are excluded (a plain \b matches before
// a hyphen, which would wrongly flag them).
const MARKUP_EL = /<\s*(audio|video)(?![\w-])/i;

// Web clamp signals. A muted attribute or .muted assignment is NEVER a
// clamp (volume stays at 1.0 once unmuted), so neither is in this set;
// the finding message states that explicitly.
const VOL_ASSIGN = /\.volume\s*=\s*(?!=)/;
const VOL_ATTR = /\bvolume\s*=\s*(['"])\s*(?:0?\.\d+|0|1(?:\.0+)?)\s*\1/i;

// Dart branch, byte-for-byte the original loop body, lifted into a
// helper. lines are the raw (uncommented-stripped) Dart lines.
function dartMatch(
  file: string,
  lines: string[],
  projectRoot: string,
  findings: AuditFinding[],
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip Dart line-comment lines and dartdoc.
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;
    const isConstruction = CONSTRUCTORS.some((re) => re.test(line));
    if (!isConstruction) continue;
    // Look in a 30-line window for a setVolume call.
    const window = lines.slice(i, i + 30).join('\n');
    if (!VOLUME_CALL.test(window)) {
      findings.push({
        where: `${relative(projectRoot, file)}:${i + 1}`,
        message: `Audio/video player constructed without a setVolume() call within 30 lines. ` +
          `Standards 1, 14: kids' audio apps must clamp playback below the WHO safe-listening ceiling. ` +
          `Either call setVolume() with your project's safe cap, or add the file to opts.allowlists.volumeCapExempt with written justification.`,
        standards: [1, 14],
      });
    }
  }
}

// Web branch. lines are already comment-stripped (blanked) so commented
// constructions never match and a commented .volume = is not a clamp.
function webMatch(
  file: string,
  lines: string[],
  lang: Lang,
  projectRoot: string,
  findings: AuditFinding[],
): void {
  const isMarkup = lang === 'html' || lang === 'vue' || lang === 'svelte';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isConstruction =
      NEW_AUDIO.test(line) ||
      CREATE_EL.test(line) ||
      (isMarkup && MARKUP_EL.test(line));
    if (!isConstruction) continue;
    const window = lines.slice(i, i + 30).join('\n');
    const clamped = VOL_ASSIGN.test(window) || (isMarkup && VOL_ATTR.test(window));
    if (clamped) continue;
    findings.push({
      where: `${relative(projectRoot, file)}:${i + 1}`,
      message:
        `Web audio/video player constructed without an explicit volume clamp within 30 lines. ` +
        `Standards 1, 14: kids' audio apps must clamp playback below the WHO safe-listening ceiling. ` +
        `Set HTMLMediaElement.volume to your project's safe cap (for example el.volume = 0.4) or add a volume attribute on the element. ` +
        `Note: .muted (or a muted attribute) is NOT a volume cap, because volume stays at 1.0 once unmuted. ` +
        `If this player legitimately must run uncapped (for example a calibrated tone used by a hearing test), add the file to opts.allowlists.volumeCapExempt with written justification.`,
      standards: [1, 14],
    });
  }
}

export async function auditVolumeCap(opts: AuditOptions): Promise<AuditResult> {
  const findings: AuditFinding[] = [];
  let scanned = 0;
  // Allow callers to opt files out via opts.allowlists.volumeCapExempt
  // (e.g. test fixtures, or domain-specific files that must emit
  // calibrated/uncapped audio such as a calibrated tone player used by
  // a hearing test).
  const exemptSubstrings = opts.allowlists?.volumeCapExempt ?? [
    '/test/',
  ];

  for (const file of walk(opts.projectRoot, {
    filter: (p) => (isDartFile(p) || isWebFile(p)) && !isMetadataOrGenerated(p),
  })) {
    if (exemptSubstrings.some((s) => file.includes(s))) continue;
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    scanned++;
    if (isDartFile(file)) {
      // Dart branch keeps its original raw-line behaviour verbatim.
      dartMatch(file, body.split('\n'), opts.projectRoot, findings);
    } else {
      const lang = langForFile(file);
      const lines = stripComments(body.split('\n'), lang);
      webMatch(file, lines, lang, opts.projectRoot, findings);
    }
  }

  if (scanned === 0) {
    return {
      id: 'volume-cap',
      title: 'Explicit volume cap on every audio/video player',
      standards: [1, 14],
      severity: 'pass',
      findings: [],
      applicable: false,
      scanned: 0,
      summary:
        'No Dart or web source files found; nothing to audit. Add audio/video code or remove paths from opts.allowlists.volumeCapExempt to make this audit applicable.',
    };
  }

  return {
    id: 'volume-cap',
    title: 'Explicit volume cap on every audio/video player',
    standards: [1, 14],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    scanned,
    summary:
      findings.length === 0
        ? 'Every player construction is followed by an explicit volume clamp (or is on the exempt list).'
        : `${findings.length} player(s) without an explicit volume clamp. Each is a child-hearing-safety risk.`,
  };
}
