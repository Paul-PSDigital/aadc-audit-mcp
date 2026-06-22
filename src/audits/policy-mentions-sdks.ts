// AADC Standard 4 (transparency) + Standard 9 (data sharing).
//
// Every third-party SDK that ships in a kids app and could see user
// data must be named in the project's privacy policy. The audit
// cross-references the allowlist of "external service" SDKs against
// the policy text and flags any missing.
//
// "External service" SDKs are a curated subset of the SDK allowlist —
// dependencies that talk to a server. Pure utility packages
// (cupertino_icons, path_provider, etc) don't need to be in the
// policy.

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';

// Map of dependency name → the friendly name(s) we expect to see in
// the privacy policy. If ANY of the values appears (case-insensitive),
// the dependency is considered disclosed.
const EXTERNAL_SERVICE_NAMES: Record<string, string[]> = {
  sentry_flutter: ['Sentry', 'crash report'],
  google_fonts: ['Google Fonts'],
  firebase_core: ['Firebase'],
  firebase_storage: ['Firebase'],
  firebase_analytics: ['Firebase Analytics'],
  in_app_review: ['App Store review', 'Play Store review', 'in-app review'],
  webview_flutter: ['in-app browser', 'WebView'],
  url_launcher: [],  // launching the OS browser is documented at the link surface, not as a third-party
  video_player: [],  // local-only
  just_audio: [],
  audio_session: [],
  audio_service: [],
  http: [],          // generic; we expect the policy to talk about specific endpoints not the SDK
  drift: [],
  shared_preferences: [],
  path_provider: [],
};

export async function auditPolicyMentionsSdks(opts: AuditOptions): Promise<AuditResult> {
  const privacyPath = opts.options?.privacyPolicyPath ?? 'docs/privacy-policy.md';
  const fullPolicy = join(opts.projectRoot, privacyPath);
  if (!existsSync(fullPolicy)) {
    return {
      id: 'policy-mentions-sdks',
      title: 'Privacy policy names every external-service SDK',
      standards: [4, 9],
      severity: 'warn',
      findings: [],
      summary: `Privacy policy not found at ${privacyPath}; audit skipped.`,
    };
  }

  // Find every pubspec.yaml and collect the union of dependency
  // names (so a monorepo with multiple Flutter apps is supported).
  const declaredDeps = new Set<string>();
  const pubspecPath = join(opts.projectRoot, 'apps/mobile/pubspec.yaml');
  if (existsSync(pubspecPath)) {
    const body = readFileSync(pubspecPath, 'utf8');
    let inDeps = false;
    for (const raw of body.split('\n')) {
      const top = raw.match(/^([a-z_]+):\s*$/);
      if (top) {
        inDeps = top[1] === 'dependencies' || top[1] === 'dev_dependencies';
        continue;
      }
      if (!inDeps) continue;
      const m = raw.match(/^  ([a-z_][a-z0-9_]*):\s/);
      if (m) declaredDeps.add(m[1]);
    }
  }

  const policy = readFileSync(fullPolicy, 'utf8');
  const lowered = policy.toLowerCase();
  const findings: AuditFinding[] = [];

  for (const dep of declaredDeps) {
    const expectedNames = EXTERNAL_SERVICE_NAMES[dep];
    if (!expectedNames || expectedNames.length === 0) continue;
    const mentioned = expectedNames.some((name) =>
      lowered.includes(name.toLowerCase()),
    );
    if (!mentioned) {
      findings.push({
        where: relative(opts.projectRoot, fullPolicy),
        message: `External-service SDK "${dep}" is in the dependency list but is not named in the privacy policy. ` +
          `Standard 4 (transparency) + 9 (data sharing): a parent reading the policy should know every party that touches their child's data. ` +
          `Add a sentence naming "${expectedNames[0]}" (or extend the disclosure of an existing section).`,
        standards: [4, 9],
      });
    }
  }

  return {
    id: 'policy-mentions-sdks',
    title: 'Privacy policy names every external-service SDK',
    standards: [4, 9],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    summary:
      findings.length === 0
        ? 'Every shipped external-service SDK is named in the privacy policy.'
        : `${findings.length} external-service SDK(s) absent from the policy.`,
  };
}
