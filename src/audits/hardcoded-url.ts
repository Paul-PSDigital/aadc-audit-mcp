// AADC Standard 6 (policies and community standards): uphold your
// published terms — and Standard 4 (transparency).
//
// URLs hardcoded in app code can't be remotely fixed when a link rots
// or a host changes. For a CMS-driven kids app, every outbound URL
// shown to a user (or used in network calls) should live in the CMS
// (uiStrings, content) so the editor can repair it without a binary
// release. Hardcoded URLs in code are a future Standard 6 incident
// waiting to happen.
//
// Two exceptions are allowed:
//   - URLs inside files under opts.allowlists.urlExemptPaths
//     (typically config / bootstrap / native bridge files).
//   - URLs that are exact-matched in opts.allowlists.urlExemptValues.
//
// The audit applies to Dart files only by default; web / native code
// can be added by extending the file-filter.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';

const URL_RE = /(['"`])(https?:\/\/[^'"`\s]+)\1/g;

const DEFAULT_EXEMPT_PATHS = [
  '/config.dart',           // the manifest URL + public key bootstrap
  '/test/',                  // tests can use literal URLs freely
];

const DEFAULT_EXEMPT_VALUES = [
  'about:blank',
];

export async function auditHardcodedUrl(opts: AuditOptions): Promise<AuditResult> {
  const exemptPaths = opts.allowlists?.urlExemptPaths ?? DEFAULT_EXEMPT_PATHS;
  const exemptValues = new Set(
    opts.allowlists?.urlExemptValues ?? DEFAULT_EXEMPT_VALUES,
  );
  const findings: AuditFinding[] = [];

  for (const file of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('.dart'),
  })) {
    if (exemptPaths.some((s) => file.includes(s))) continue;
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = body.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip line comments + dartdoc; those are usually documentation.
      if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;
      URL_RE.lastIndex = 0;
      let m;
      while ((m = URL_RE.exec(line)) !== null) {
        const url = m[2];
        if (exemptValues.has(url)) continue;
        // Strip query / fragment for the exempt-values match too.
        const stripped = url.split(/[?#]/)[0];
        if (exemptValues.has(stripped)) continue;
        findings.push({
          where: `${relative(opts.projectRoot, file)}:${i + 1}`,
          message: `Hardcoded URL "${url}". Standard 6: move to CMS (uiStrings) so editors can refresh without a binary release. ` +
            `If this URL legitimately belongs in code (config bootstrap, native bridge), add the file or value to opts.allowlists.urlExemptPaths / urlExemptValues.`,
          standards: [4, 6],
        });
      }
    }
  }

  return {
    id: 'hardcoded-url',
    title: 'Hardcoded URLs outside CMS',
    standards: [4, 6],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    summary:
      findings.length === 0
        ? 'No hardcoded URLs found in Dart source outside the exempt config paths.'
        : `${findings.length} hardcoded URL(s) that can't be remotely repaired if the link rots. Move to CMS.`,
  };
}
