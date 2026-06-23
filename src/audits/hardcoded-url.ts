// AADC Standard 6 (policies and community standards): uphold your
// published terms, and Standard 4 (transparency).
//
// URLs hardcoded in app code can't be remotely fixed when a link rots
// or a host changes. Every outbound URL shown to a user (or used in
// network calls) should live in a remotely-updatable source (a CMS,
// remote config, or your localized strings layer) so it can be
// repaired without shipping a new binary. Hardcoded URLs in code are a
// future Standard 6 incident waiting to happen.
//
// Two exceptions are allowed:
//   - URLs inside files under opts.allowlists.urlExemptPaths
//     (typically config / bootstrap / native bridge files, e.g.
//     '/config.dart').
//   - URLs that are exact-matched in opts.allowlists.urlExemptValues.
//
// The audit walks Dart source AND web source (.js/.mjs/.cjs/.jsx/.ts/
// .tsx/.html/.htm/.vue/.svelte). Per-language comment stripping means
// URLs inside // ... , /* ... */, and <!-- ... --> never flag. The web
// pass adds structural denylists so namespace/schema/DOCTYPE URLs,
// source-map pragmas, module import/require specifiers, dev/loopback
// hosts, $schema keys, and HTML infrastructure <link>/<script> CDN
// references are ignored, while an <a href> to an external site (the
// real rotting-link risk) still flags. The same URL_RE, exempt paths,
// exempt values, and query/fragment stripping are reused for both
// languages, so Dart behaviour is a strict superset of correctness:
// the only change is that trailing and multi-line comments are now
// stripped before matching, which can only remove false positives.

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
  hostOf,
  isDevHost,
  type Lang,
} from './web-source.js';

const URL_RE = /(['"`])(https?:\/\/[^'"`\s]+)\1/g;

const DEFAULT_EXEMPT_PATHS = [
  '/test/',                  // tests can use literal URLs freely
  // Add config / bootstrap / native-bridge files (e.g. '/config.dart',
  // a manifest-URL + public-key bootstrap) via opts.allowlists.urlExemptPaths.
];

const DEFAULT_EXEMPT_VALUES = [
  'about:blank',
  // Canonical XML / SVG / XHTML namespace tokens. These are structural
  // identifiers that MUST be these exact strings for the markup to
  // parse; they are never fetched and must never move to a CMS.
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/1999/xhtml',
];

// --- hardcoded-url-LOCAL structural denylists (web only) -------------
// Kept local to this audit so the shared web-source module is not
// polluted with hardcoded-url-specific exemption policy.

// Hosts that are namespace / schema / DTD identifiers, not navigable
// content. Suffix-matched against the URL host (case-insensitive).
const NAMESPACE_HOST_SUFFIXES = [
  'w3.org', 'schemas.microsoft.com', 'schemas.android.com',
  'schemas.openxmlformats.org', 'purl.org', 'xmlns.com', 'ns.adobe.com',
  'inkscape.org', 'sodipodi.sourceforge.net', 'apple.com', 'java.sun.com',
  'docbook.org', 'schema.org',
];

// CDN / font infrastructure hosts. A <link href>/<script src> to one of
// these is asset plumbing, not editorial content.
const CDN_HOST_SUFFIXES = [
  'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com', 'unpkg.com', 'ajax.googleapis.com',
  'code.jquery.com', 'use.fontawesome.com', 'polyfill.io',
];

// <link rel> values that mark an infrastructure tag (preconnect, font
// stylesheet, manifest, canonical, etc.) rather than editorial content.
const INFRA_LINK_RELS =
  /\brel\s*=\s*["']?(preconnect|dns-prefetch|preload|prefetch|modulepreload|stylesheet|manifest|icon|apple-touch-icon|mask-icon|canonical|alternate)\b/i;

function hostEndsWith(host: string, suffixes: string[]): boolean {
  const h = host.toLowerCase();
  return suffixes.some((s) => h === s || h.endsWith('.' + s));
}

// Is the matched URL a namespace / schema / DOCTYPE structural value?
function isNamespaceContext(line: string, preMatch: string, host: string): boolean {
  if (hostEndsWith(host, NAMESPACE_HOST_SUFFIXES)) return true;
  if (/\b(xmlns(:[a-z0-9_-]+)?|xsi:schemaLocation|schemaLocation|xml:base|targetNamespace)\s*=\s*$/i.test(preMatch)) {
    return true;
  }
  const trimmed = line.trimStart();
  if (/^<!DOCTYPE/i.test(trimmed)) return true;
  if (/<!(DOCTYPE|ENTITY)[^>]*\b(PUBLIC|SYSTEM)\b/i.test(line)) return true;
  return false;
}

// Is the URL a build-tool source-map / source pragma?
function isSourceMapPragma(line: string, preMatch: string): boolean {
  if (/^\s*\/[/*]#\s*source(Mapping)?URL=/i.test(line)) return true;
  if (/source(Mapping)?URL\s*=\s*$/i.test(preMatch)) return true;
  return false;
}

// Is the URL an ESM / CommonJS module specifier (import/export-from/
// require/dynamic-import/new URL(..., import.meta.url))?
function isModuleSpecifier(preMatch: string, postMatch: string): boolean {
  if (/\b(import|export)\b[^'"`]*\bfrom\s*$/.test(preMatch)) return true;
  if (/\bimport\s*\(\s*$/.test(preMatch)) return true;
  if (/\brequire\s*\(\s*$/.test(preMatch)) return true;
  if (/^\s*import\s+$/.test(preMatch)) return true;
  if (/new\s+URL\s*\(\s*$/.test(preMatch) && /import\.meta\.url/.test(postMatch)) return true;
  return false;
}

// Is the URL a JSON $schema key value (defensive: .json is not scanned,
// but JSON embedded in .ts/.js could carry one)?
function isSchemaKey(preMatch: string): boolean {
  return /"\$schema"\s*:\s*$/.test(preMatch);
}

// HTML-only: is the match inside an infrastructure <link>/<script src>
// tag, or a <link>/<script> to a CDN host? Returns true to EXEMPT.
// An <a href> to an external host is NOT exempted here, so it survives.
function isHtmlInfraOrCdn(line: string, matchIndex: number, host: string): boolean {
  // Find the enclosing tag: the nearest '<' at or before the match.
  const open = line.lastIndexOf('<', matchIndex);
  if (open === -1) return false;
  const tagSlice = line.slice(open);
  const nameMatch = /^<\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(tagSlice);
  const tagName = nameMatch ? nameMatch[1].toLowerCase() : '';
  if (tagName === 'link') {
    if (INFRA_LINK_RELS.test(tagSlice)) return true;
    if (hostEndsWith(host, CDN_HOST_SUFFIXES)) return true;
    return false;
  }
  if (tagName === 'script') {
    if (hostEndsWith(host, CDN_HOST_SUFFIXES)) return true;
    return false;
  }
  return false;
}

export async function auditHardcodedUrl(opts: AuditOptions): Promise<AuditResult> {
  const exemptPaths = opts.allowlists?.urlExemptPaths ?? DEFAULT_EXEMPT_PATHS;
  const exemptValues = new Set(
    opts.allowlists?.urlExemptValues ?? DEFAULT_EXEMPT_VALUES,
  );
  const findings: AuditFinding[] = [];
  let scanned = 0;

  for (const file of walk(opts.projectRoot, {
    filter: (p) => (isDartFile(p) || isWebFile(p)) && !isMetadataOrGenerated(p),
  })) {
    if (exemptPaths.some((s) => file.includes(s))) continue;
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    scanned++;
    const lang: Lang = langForFile(file);
    const isHtml = lang === 'html' || lang === 'vue' || lang === 'svelte';
    const lines = stripComments(body.split('\n'), lang);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      URL_RE.lastIndex = 0;
      let m;
      while ((m = URL_RE.exec(line)) !== null) {
        const url = m[2];
        if (exemptValues.has(url)) continue;
        // Strip query / fragment for the exempt-values match too.
        const stripped = url.split(/[?#]/)[0];
        if (exemptValues.has(stripped)) continue;

        // Structural denylists, applied in order. The opening quote is
        // m[1] at m.index; the URL value starts just after it.
        const preMatch = line.slice(0, m.index);
        const postMatch = line.slice(m.index + m[0].length);
        const host = hostOf(url);

        if (isNamespaceContext(line, preMatch, host)) continue;
        if (isSourceMapPragma(line, preMatch)) continue;
        if (isModuleSpecifier(preMatch, postMatch)) continue;
        if (isDevHost(host)) continue;
        if (isSchemaKey(preMatch)) continue;
        if (isHtml && isHtmlInfraOrCdn(line, m.index, host)) continue;

        findings.push({
          where: `${relative(opts.projectRoot, file)}:${i + 1}`,
          message:
            `Hardcoded URL "${url}" in ${lang} source. Standard 6: move it to a remotely-updatable content source (a CMS, remote config, or your localized strings layer) so the link can be repaired without shipping a new build. ` +
            `If this URL legitimately belongs in code (config bootstrap, native bridge, infrastructure endpoint), add the file to urlExemptPaths or the value to urlExemptValues.`,
          standards: [4, 6],
        });
      }
    }
  }

  if (scanned === 0) {
    return {
      id: 'hardcoded-url',
      title: 'Hardcoded URLs outside CMS',
      standards: [4, 6],
      severity: 'pass',
      findings: [],
      applicable: false,
      scanned: 0,
      summary: 'No Dart or web source files found; nothing to audit.',
    };
  }

  return {
    id: 'hardcoded-url',
    title: 'Hardcoded URLs outside CMS',
    standards: [4, 6],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    scanned,
    summary:
      findings.length === 0
        ? 'No hardcoded URLs found in Dart or web source outside the exempt config paths.'
        : `${findings.length} hardcoded URL(s) that can't be remotely repaired if the link rots. Move to CMS.`,
  };
}
