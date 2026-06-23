// Shared helpers for the web-aware audits (hardcoded-url, volume-cap,
// launchurl). Keeping discovery, comment-stripping, and URL-host
// parsing in one module guarantees all three audits walk the same file
// set and agree on what is a comment and what host a URL points at.

import { basename } from 'node:path';

// Union of every web source extension the three audits care about.
// hardcoded-url scanning .vue/.svelte is harmless (it only matches
// quoted http(s) literals), so a single discovery list serves all.
export const WEB_EXTS = [
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.html', '.htm', '.vue', '.svelte',
];

export function isWebFile(p: string): boolean {
  return WEB_EXTS.some((ext) => p.endsWith(ext));
}

export function isDartFile(p: string): boolean {
  return p.endsWith('.dart');
}

// Lockfiles, dependency manifests, and editor/build config that happen
// to carry http(s) strings (schema URLs, registry URLs) but are not
// user-facing content. walk() already skips node_modules/dist/build,
// this is the belt-and-braces layer for the rest.
const METADATA_BASENAMES = new Set([
  'package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock',
  'pnpm-lock.yaml', 'composer.json', 'composer.lock', 'tsconfig.json',
  'jsconfig.json', 'manifest.json', 'deno.json', 'import_map.json',
]);

const GENERATED_DIR_FRAGMENTS = [
  '/node_modules/', '/dist/', '/build/', '/vendor/', '/.next/', '/.nuxt/', '/coverage/',
];

export function isMetadataOrGenerated(p: string): boolean {
  const base = basename(p);
  if (METADATA_BASENAMES.has(base)) return true;
  if (/\.min\.(js|mjs|cjs)$/.test(base)) return true;
  if (/\.bundle\.(js|mjs|cjs)$/.test(base)) return true;
  const norm = p.split('\\').join('/');
  return GENERATED_DIR_FRAGMENTS.some((d) => norm.includes(d));
}

export type Lang = 'dart' | 'js' | 'html' | 'vue' | 'svelte';

export function langForFile(p: string): Lang {
  if (p.endsWith('.dart')) return 'dart';
  if (p.endsWith('.html') || p.endsWith('.htm')) return 'html';
  if (p.endsWith('.vue')) return 'vue';
  if (p.endsWith('.svelte')) return 'svelte';
  return 'js';
}

// Replace comment text with spaces, preserving line count and column
// positions so a finding can still cite the correct 1-based line. The
// only cross-line state carried is whether we are inside a /* */ block
// (JS) or an <!-- --> comment / <script>|<style> region (markup).
export function stripComments(lines: string[], lang: Lang): string[] {
  if (lang === 'html' || lang === 'vue' || lang === 'svelte') {
    return stripMarkup(lines);
  }
  return stripJs(lines);
}

// Chars that, when they are the last non-whitespace code char on the
// line, put a following '/' in an expression position so it begins a
// regex literal rather than a division operator. '' (start of line)
// also counts as an expression position.
const REGEX_PREFIX_CHARS = new Set(
  ['(', ',', ';', '{', '[', '=', ':', '!', '&', '|', '?', '+', '-', '*', '%', '^', '~', '<', '>'],
);

// JS-family (and Dart) stripper. Quote-state-aware so the // inside a
// quoted https:// URL is never mistaken for a line comment. Also
// regex-literal-aware so a /.../ literal is consumed as opaque code and
// its internal // , quotes, and \/\/ never trigger comment-mode or
// string-mode. Dart has no regex literals, but a Dart '/' is always in
// division position (prevSig is a value char or '') so it is copied as
// a normal char, leaving Dart behaviour unchanged.
function stripJs(lines: string[]): string[] {
  const out: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    let res = '';
    let i = 0;
    let inStr: string | null = null;
    // Last non-whitespace code char emitted on this line. Reset per
    // line. After a string or regex literal we set it to a value-marker
    // ')' so a following '/' reads as division, not a regex start.
    let prevSig = '';
    while (i < line.length) {
      const c = line[i];
      const c2 = line[i + 1];
      if (inBlock) {
        if (c === '*' && c2 === '/') { res += '  '; i += 2; inBlock = false; continue; }
        res += ' '; i++; continue;
      }
      if (inStr) {
        res += c;
        if (c === '\\') {
          if (i + 1 < line.length) { res += line[i + 1]; i += 2; continue; }
          i++; continue;
        }
        if (c === inStr) { inStr = null; prevSig = ')'; }
        i++; continue;
      }
      if (c === '/' && c2 === '/') { res += ' '.repeat(line.length - i); break; }
      if (c === '/' && c2 === '*') { inBlock = true; res += '  '; i += 2; continue; }
      // A '/' that is not a comment opener: decide regex vs division.
      if (c === '/') {
        if (prevSig === '' || REGEX_PREFIX_CHARS.has(prevSig)) {
          // Regex literal: consume it verbatim so its internal // ,
          // quotes, and escaped slashes never flip comment/string mode.
          res += c; i++;
          let inClass = false;
          while (i < line.length) {
            const rc = line[i];
            if (rc === '\\') {
              res += rc;
              if (i + 1 < line.length) { res += line[i + 1]; i += 2; }
              else { i++; }
              continue;
            }
            if (rc === '[') { inClass = true; res += rc; i++; continue; }
            if (rc === ']') { inClass = false; res += rc; i++; continue; }
            if (rc === '/' && !inClass) { res += rc; i++; break; }
            res += rc; i++;
          }
          // Copy trailing flag letters (g, i, m, s, u, y, etc).
          while (i < line.length && /[a-z]/i.test(line[i])) { res += line[i]; i++; }
          prevSig = ')';
          continue;
        }
        // Division operator: copy as a normal char.
        res += c; prevSig = c; i++; continue;
      }
      if (c === '"' || c === '\'' || c === '`') { inStr = c; res += c; i++; continue; }
      res += c;
      if (c !== ' ' && c !== '\t') prevSig = c;
      i++;
    }
    out.push(res);
  }
  return out;
}

// Markup stripper for .html/.htm/.vue/.svelte. Blanks <!-- --> spans,
// switches to JS rules inside <script>...</script> and to CSS /* */
// rules inside <style>...</style>. Outside those regions attribute
// values are left live so <a href="..."> URLs survive to be matched.
function stripMarkup(lines: string[]): string[] {
  const out: string[] = [];
  let mode: 'normal' | 'script' | 'style' = 'normal';
  let inHtmlComment = false;
  let inBlock = false;          // JS or CSS block comment
  let inStr: string | null = null; // string literal inside <script>
  for (const line of lines) {
    let res = '';
    let i = 0;
    while (i < line.length) {
      const c = line[i];
      const c2 = line[i + 1];
      if (inHtmlComment) {
        if (c === '-' && c2 === '-' && line[i + 2] === '>') { res += '   '; i += 3; inHtmlComment = false; continue; }
        res += ' '; i++; continue;
      }
      if (mode === 'normal') {
        if (c === '<' && line.slice(i, i + 4) === '<!--') { inHtmlComment = true; res += '    '; i += 4; continue; }
        if (c === '<' && /^<script\b/i.test(line.slice(i))) { mode = 'script'; inBlock = false; inStr = null; res += c; i++; continue; }
        if (c === '<' && /^<style\b/i.test(line.slice(i))) { mode = 'style'; inBlock = false; res += c; i++; continue; }
        res += c; i++; continue;
      }
      // Inside <script> or <style>.
      if (mode === 'script' && !inStr && !inBlock && /^<\/script\b/i.test(line.slice(i))) { mode = 'normal'; res += c; i++; continue; }
      if (mode === 'style' && !inBlock && /^<\/style\b/i.test(line.slice(i))) { mode = 'normal'; res += c; i++; continue; }
      if (inBlock) {
        if (c === '*' && c2 === '/') { res += '  '; i += 2; inBlock = false; continue; }
        res += ' '; i++; continue;
      }
      if (mode === 'script' && inStr) {
        res += c;
        if (c === '\\') {
          if (i + 1 < line.length) { res += line[i + 1]; i += 2; continue; }
          i++; continue;
        }
        if (c === inStr) inStr = null;
        i++; continue;
      }
      if (mode === 'script' && c === '/' && c2 === '/') { res += ' '.repeat(line.length - i); break; }
      if (c === '/' && c2 === '*') { inBlock = true; res += '  '; i += 2; continue; }
      if (mode === 'script' && (c === '"' || c === '\'' || c === '`')) { inStr = c; res += c; i++; continue; }
      res += c; i++;
    }
    out.push(res);
  }
  return out;
}

// Parse the host out of an http(s) URL without the WHATWG URL
// constructor (which throws on relative inputs). Returns lowercase host
// with no port/path/query/fragment.
export function hostOf(url: string): string {
  // Strip a single trailing root dot ("mysite.com." === "mysite.com"
  // per DNS) so an FQDN-root form is not treated as a different host.
  return url
    .replace(/^https?:\/\//i, '')
    .split(/[/:?#]/)[0]
    .toLowerCase()
    .replace(/\.$/, '');
}

// RFC-reserved / loopback / private-dev hosts that are never a
// user-facing rotting-link risk.
export const DEV_HOST_SUFFIXES = [
  'localhost', '127.0.0.1', '0.0.0.0', '::1',
  '.local', '.test', '.example', '.invalid', '.localhost',
];

export function isDevHost(host: string): boolean {
  const h = host.toLowerCase();
  return DEV_HOST_SUFFIXES.some((s) => (s.startsWith('.') ? h.endsWith(s) : h === s));
}

// For launchurl: is a link value an external navigation, a first-party
// one, or not an absolute http(s) URL at all (relative/hash/mailto/tel
// /data/blob/javascript, all of which stay inside the app). 'unknown'
// (a non-literal argument) is handled by launchurl itself, not here.
export function classifyUrl(
  value: string,
  firstPartyOrigins: string[],
): 'firstparty' | 'external' {
  let host: string;
  if (/^https?:\/\//i.test(value)) {
    host = hostOf(value);
  } else if (/^\/\/[^/]/.test(value)) {
    // Protocol-relative ("//host/path"): a real cross-origin navigation
    // that resolves to the current page scheme, not a first-party path.
    // Extract the host (chars after the leading // up to the next
    // / : ? #) and run the same first-party-origin check as an absolute
    // URL. Strip a single trailing root dot for FQDN-root parity.
    host = value.slice(2).split(/[/:?#]/)[0].toLowerCase().replace(/\.$/, '');
  } else {
    // Relative / hash / mailto / tel / data / blob / javascript: all
    // stay inside the app.
    return 'firstparty';
  }
  const fp = firstPartyOrigins.map((o) => hostOf(o));
  if (fp.some((o) => o.length > 0 && (host === o || host.endsWith('.' + o)))) {
    return 'firstparty';
  }
  return 'external';
}
