// AADC Standard 1 (best interests of the child) + Standard 14
// (connected toys and devices).
//
// Kids' audio apps need an explicit volume cap on every player
// instance. WHO Make Listening Safe puts the recommended ceiling for
// children at 75 dB SPL sustained. A player created without a
// setVolume call defaults to 1.0 (no attenuation), which means OS
// volume × content volume → unbounded at the eardrum / kit
// transducer.
//
// This audit walks every Dart file and flags any AudioPlayer() /
// VideoPlayerController construction that isn't followed by a
// setVolume(...) call within the next 30 lines of the same file.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';

const CONSTRUCTORS = [
  /\bAudioPlayer\s*\(\s*\)/,
  /\bVideoPlayerController\.networkUrl\s*\(/,
  /\bVideoPlayerController\.file\s*\(/,
  /\bVideoPlayerController\.asset\s*\(/,
];

const VOLUME_CALL = /\.setVolume\s*\(/;

export async function auditVolumeCap(opts: AuditOptions): Promise<AuditResult> {
  const findings: AuditFinding[] = [];
  // Allow callers to opt files out (e.g. test fixtures, the tone
  // player used by the calibrated hearing test).
  const exemptSubstrings = opts.allowlists?.volumeCapExempt ?? [
    '/test/',
    '/tone_player.dart',  // hearing-test tones must use calibrated levels
  ];

  for (const file of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('.dart'),
  })) {
    if (exemptSubstrings.some((s) => file.includes(s))) continue;
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = body.split('\n');
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
          where: `${relative(opts.projectRoot, file)}:${i + 1}`,
          message: `Audio/video player constructed without a setVolume() call within 30 lines. ` +
            `Standards 1, 14: kids' audio apps must clamp playback below the WHO safe-listening ceiling. ` +
            `Either call setVolume() with your project's safe cap, or add the file to opts.allowlists.volumeCapExempt with written justification.`,
          standards: [1, 14],
        });
      }
    }
  }

  return {
    id: 'volume-cap',
    title: 'Explicit volume cap on every audio/video player',
    standards: [1, 14],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    summary:
      findings.length === 0
        ? 'Every player construction is followed by an explicit setVolume() call (or is on the exempt list).'
        : `${findings.length} player(s) without explicit setVolume. Each is a child-hearing-safety risk.`,
  };
}
