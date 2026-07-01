// Audit registry. Each audit is a discrete check that the CLI can run
// individually and the MCP server exposes as a tool.

import type { AuditOptions, AuditResult } from './types.js';
import { auditPermissions } from './permissions.js';
import { auditSdks } from './sdks.js';
import { auditLaunchUrl } from './launchurl.js';
import { auditNetworkIsolation } from './network-isolation.js';
import { auditDefaults } from './defaults.js';
import { auditReadingGrade } from './reading-grade.js';
import { auditPlaceholders } from './placeholders.js';
import { auditLinkReachability } from './link-reachability.js';
import { auditVolumeCap } from './volume-cap.js';
import { auditSentryHygiene } from './sentry-hygiene.js';
import { auditHardcodedUrl } from './hardcoded-url.js';
import { auditPolicyMentionsSdks } from './policy-mentions-sdks.js';
import { auditDpiaPresent } from './dpia-present.js';
import { auditAgeAssurance } from './age-assurance.js';
import { auditDataRightsTools } from './data-rights-tools.js';
import { auditParentGate } from './parent-gate.js';
import { auditParentGateRoutes } from './parent-gate-routes.js';

export type AuditFn = (opts: AuditOptions) => Promise<AuditResult>;

export const AUDITS: Record<string, AuditFn> = {
  permissions: auditPermissions,
  sdks: auditSdks,
  launchurl: auditLaunchUrl,
  'network-isolation': auditNetworkIsolation,
  defaults: auditDefaults,
  'reading-grade': auditReadingGrade,
  placeholders: auditPlaceholders,
  'link-reachability': auditLinkReachability,
  'volume-cap': auditVolumeCap,
  'sentry-hygiene': auditSentryHygiene,
  'hardcoded-url': auditHardcodedUrl,
  'policy-mentions-sdks': auditPolicyMentionsSdks,
  'dpia-present': auditDpiaPresent,
  'age-assurance': auditAgeAssurance,
  'data-rights-tools': auditDataRightsTools,
  'parent-gate': auditParentGate,
  'parent-gate-routes': auditParentGateRoutes,
};

export async function runAll(opts: AuditOptions): Promise<AuditResult[]> {
  const results: AuditResult[] = [];
  for (const id of Object.keys(AUDITS)) {
    results.push(await AUDITS[id](opts));
  }
  return results;
}

export type { AuditOptions, AuditResult } from './types.js';
