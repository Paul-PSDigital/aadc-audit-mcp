// AADC Standards 4 (transparency) + 6 (uphold your published terms).
//
// Walks declared outbound-link URLs in the project (regex sweep
// across source files for http/https URLs hosted on known trusted
// outbound destinations) and probes each one with a HEAD / GET. Any
// non-2xx/3xx → finding.
//
// This audit is OPT-IN because it depends on network access. Enable
// by setting opts.options.checkLinks="true" or passing
// AADC_CHECK_LINKS=1. Without that flag the audit short-circuits to
// "skipped" so it never breaks an offline CI run.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';

// Hosts we expect a UK kids app to link out to. Anything else gets
// reported as "untrusted host" (a different concern, but adjacent —
// the worker URL guard catches this primarily; this audit's the
// belt-and-braces external probe).
const TRUSTED_HOST_SUFFIXES = [
  'nhs.uk', 'ndcs.org.uk', 'hearglueear.app', 'hearglueear.co.uk',
  'apps.apple.com', 'play.google.com', 'forms.gle', 'docs.google.com',
  'youtube.com', 'youtu.be', 'vimeo.com', 'ico.org.uk',
  // Project-specific: kit vendors. Override per-project if your trust
  // list differs.
  'thepihut.com', 'raspberrypi.com',
];

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
};

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return TRUSTED_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

async function probe(url: string): Promise<{ ok: boolean; status: number; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: REQUEST_HEADERS,
    });
    if (res.status === 405 || res.status === 403 || res.status === 404) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: REQUEST_HEADERS,
      });
    }
    return { ok: res.status >= 200 && res.status < 400, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: String((e as Error).message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

const URL_RE = /https?:\/\/[^\s'"<>)]+/g;

export async function auditLinkReachability(opts: AuditOptions): Promise<AuditResult> {
  const enabled =
    opts.options?.checkLinks === 'true' || process.env.AADC_CHECK_LINKS === '1';
  if (!enabled) {
    return {
      id: 'link-reachability',
      title: 'External link reachability',
      standards: [4, 6],
      severity: 'warn',
      findings: [],
      summary:
        'SKIPPED — set opts.options.checkLinks="true" or AADC_CHECK_LINKS=1 to enable. ' +
        'Audit makes outbound HTTP requests, so it is opt-in.',
    };
  }

  // Collect candidate URLs from likely-content files only (don't probe
  // every URL in node_modules transitively).
  const candidates = new Map<string, string>(); // url → first-seen location
  for (const file of walk(opts.projectRoot, {
    filter: (p) =>
      (p.endsWith('.md') ||
        p.endsWith('.json') ||
        p.endsWith('.yaml') ||
        p.endsWith('.yml') ||
        p.endsWith('.mjs') ||
        p.endsWith('.js') ||
        p.endsWith('.ts') ||
        p.endsWith('.dart')) &&
      !p.includes('/node_modules/') &&
      !p.includes('/dist/') &&
      !p.includes('/build/') &&
      !p.includes('/.dart_tool/') &&
      !p.endsWith('package-lock.json'),
  })) {
    let body: string;
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = body.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const matches = lines[i].match(URL_RE);
      if (!matches) continue;
      for (const raw of matches) {
        // Strip trailing punctuation that often appears in prose.
        const url = raw.replace(/[.,;:!?'"`)\]]+$/, '');
        try {
          const host = new URL(url).hostname.toLowerCase();
          if (!hostAllowed(host)) continue;
        } catch {
          continue;
        }
        if (!candidates.has(url)) {
          candidates.set(url, `${relative(opts.projectRoot, file)}:${i + 1}`);
        }
      }
    }
  }

  const findings: AuditFinding[] = [];
  let transient = 0;
  for (const [url, where] of candidates.entries()) {
    const res = await probe(url);
    if (res.ok) continue;
    // Distinguish transient / rate-limited / server-side from genuine
    // 4xx-Gone. A 429 or 5xx is not a content problem; flag only as a
    // warning rather than a content failure.
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      transient += 1;
      continue;
    }
    findings.push({
      where,
      message: `Outbound URL unreachable: ${url} → ${res.error ?? `HTTP ${res.status}`}. ` +
        `Standard 4 / 6: parents can't rely on links you publish. Refresh in CMS or unpublish.`,
      standards: [4, 6],
    });
  }

  const summary =
    findings.length === 0
      ? `Probed ${candidates.size} outbound URL(s); all reachable (${transient} transient 429/5xx ignored).`
      : `${findings.length} of ${candidates.size} probed URL(s) unreachable (${transient} transient 429/5xx ignored). Refresh in CMS or unpublish.`;

  return {
    id: 'link-reachability',
    title: 'External link reachability',
    standards: [4, 6],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    summary,
  };
}
