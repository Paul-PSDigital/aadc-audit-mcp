// AADC Standard 4 (transparency) + Standard 9 (data sharing).
//
// Every third-party SDK that ships in a kids app and could see user
// data must be named in the project's privacy policy. The audit
// cross-references the allowlist of "external service" SDKs against
// the policy text and flags any missing.
//
// "External service" SDKs are a curated subset of the SDK allowlist:
// dependencies that talk to a server. Pure utility packages
// (cupertino_icons, path_provider, etc) don't need to be in the
// policy.

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';
import { extractFlutterDeps, extractNpmDeps, extractPythonDeps } from './sdks.js';

// Map of dependency name -> the friendly name(s) we expect to see in
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

  // ---- npm / Node external-service SDKs ----
  '@sentry/browser': ['Sentry', 'crash report', 'error monitoring'],
  '@sentry/react': ['Sentry', 'crash report', 'error monitoring'],
  '@sentry/nextjs': ['Sentry', 'crash report', 'error monitoring'],
  '@sentry/node': ['Sentry', 'crash report', 'error monitoring'],
  '@sentry/vue': ['Sentry', 'crash report', 'error monitoring'],
  firebase: ['Firebase'],
  '@firebase/app': ['Firebase'],
  '@firebase/analytics': ['Firebase Analytics', 'Google Analytics'],
  'firebase-admin': ['Firebase'],
  'react-ga': ['Google Analytics'],
  'react-ga4': ['Google Analytics'],
  'react-gtag': ['Google Analytics', 'gtag'],
  gtag: ['Google Analytics', 'gtag'],
  '@types/gtag.js': ['Google Analytics', 'gtag'],
  'google-analytics': ['Google Analytics'],
  'posthog-js': ['PostHog'],
  'posthog-node': ['PostHog'],
  'mixpanel-browser': ['Mixpanel'],
  mixpanel: ['Mixpanel'],
  '@amplitude/analytics-browser': ['Amplitude'],
  'amplitude-js': ['Amplitude'],
  '@hotjar/browser': ['Hotjar'],
  hotjar: ['Hotjar'],
  '@segment/analytics-next': ['Segment'],
  'analytics-node': ['Segment'],
  '@vercel/analytics': ['Vercel Analytics'],
  '@datadog/browser-rum': ['Datadog', 'Datadog RUM'],
  '@fullstory/browser': ['FullStory'],
  'launchdarkly-js-client-sdk': ['LaunchDarkly'],
  '@stripe/stripe-js': ['Stripe'],
  stripe: ['Stripe'],
  'intercom-client': ['Intercom'],
  '@intercom/messenger-js-sdk': ['Intercom'],

  // ---- Python external-service SDKs ----
  'sentry-sdk': ['Sentry', 'crash report', 'error monitoring'],
  'google-analytics-data': ['Google Analytics'],
  'google-analytics-admin': ['Google Analytics'],
  'universal-analytics': ['Google Analytics'],
  posthog: ['PostHog'],
  'amplitude-analytics': ['Amplitude'],
  'analytics-python': ['Segment'],
  'segment-analytics-python': ['Segment'],
  ddtrace: ['Datadog'],
  datadog: ['Datadog'],
  'intercom-python': ['Intercom'],
  'google-cloud-bigquery': ['BigQuery', 'Google Cloud'],
};

export async function auditPolicyMentionsSdks(opts: AuditOptions): Promise<AuditResult> {
  const privacyPath = opts.options?.privacyPolicyPath ?? 'docs/privacy-policy.md';
  const fullPolicy = join(opts.projectRoot, privacyPath);
  if (!existsSync(fullPolicy)) {
    return {
      id: 'policy-mentions-sdks',
      title: 'Privacy policy names every external-service SDK',
      standards: [4, 9],
      severity: 'pass',
      findings: [],
      applicable: false,
      scanned: 0,
      summary: `Privacy policy not found at ${privacyPath}; nothing to cross-reference. Set opts.options.privacyPolicyPath to enable this audit.`,
    };
  }

  // Find every dependency manifest across all supported ecosystems and
  // collect the union of dependency names (so a monorepo with multiple
  // Flutter apps, web packages, or Python services is supported).
  const declaredDeps = new Set<string>();
  let scanned = 0;

  // Flutter / Dart
  for (const f of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('/pubspec.yaml'),
  })) {
    let body: string;
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    scanned++;
    for (const dep of extractFlutterDeps(body)) declaredDeps.add(dep);
  }

  // Node / NPM
  for (const f of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('/package.json'),
  })) {
    let body: string;
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    scanned++;
    for (const dep of extractNpmDeps(body)) declaredDeps.add(dep);
  }

  // Python
  for (const f of walk(opts.projectRoot, {
    filter: (p) => /requirements.*\.txt$/.test(p),
  })) {
    let body: string;
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    scanned++;
    for (const dep of extractPythonDeps(body)) declaredDeps.add(dep);
  }

  if (scanned === 0) {
    return {
      id: 'policy-mentions-sdks',
      title: 'Privacy policy names every external-service SDK',
      standards: [4, 9],
      severity: 'pass',
      findings: [],
      applicable: false,
      scanned: 0,
      summary: 'No dependency manifests (pubspec.yaml / package.json / requirements*.txt) found to cross-reference against the privacy policy; nothing to audit.',
    };
  }

  const policy = readFileSync(fullPolicy, 'utf8');
  const lowered = policy.toLowerCase();
  const findings: AuditFinding[] = [];

  for (const dep of declaredDeps) {
    const expectedNames = EXTERNAL_SERVICE_NAMES[dep] ?? EXTERNAL_SERVICE_NAMES[dep.toLowerCase()];
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
    scanned,
    summary:
      findings.length === 0
        ? 'Every shipped external-service SDK is named in the privacy policy.'
        : `${findings.length} external-service SDK(s) absent from the policy.`,
  };
}
