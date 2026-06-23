// Unit tests for the shared web-source helpers (classifyUrl, hostOf).
//
// Covers the protocol-relative cross-origin fix (FIX 1), the trailing
// root-dot FQDN fix (FIX 2), and confirms relative / hash / mailto /
// data values stay first-party.

import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyUrl, hostOf } from '../src/audits/web-source.js';

test('classifyUrl: protocol-relative //evil.com is external, not first-party', () => {
  assert.equal(classifyUrl('//evil.com/x', ['mysite.com']), 'external');
  assert.equal(classifyUrl('//evil-tracker.com/landing', []), 'external');
});

test('classifyUrl: protocol-relative to a declared first-party origin is first-party', () => {
  assert.equal(classifyUrl('//mysite.com/help', ['mysite.com']), 'firstparty');
  assert.equal(classifyUrl('//help.mysite.com/x', ['mysite.com']), 'firstparty');
});

test('classifyUrl: a lone "/" path (not "//host") stays first-party', () => {
  // "/foo" is a relative path; only "//host" (third char not "/") is
  // protocol-relative.
  assert.equal(classifyUrl('/foo/bar', ['mysite.com']), 'firstparty');
  assert.equal(classifyUrl('/', ['mysite.com']), 'firstparty');
});

test('classifyUrl: relative / hash / mailto / tel / data / blob / javascript stay first-party', () => {
  for (const v of [
    'about', '#section', 'mailto:hi@x.com', 'tel:+44123',
    'data:text/plain,hi', 'blob:abc', 'javascript:void(0)', 'page.html',
  ]) {
    assert.equal(classifyUrl(v, ['mysite.com']), 'firstparty', v);
  }
});

test('classifyUrl: absolute external vs first-party (regression of existing behaviour)', () => {
  assert.equal(classifyUrl('https://evil.com/x', ['mysite.com']), 'external');
  assert.equal(classifyUrl('https://mysite.com/x', ['mysite.com']), 'firstparty');
  assert.equal(classifyUrl('https://app.mysite.com/x', ['mysite.com']), 'firstparty');
});

test('hostOf: strips a single trailing root dot (FQDN-root form)', () => {
  assert.equal(hostOf('https://mysite.com.'), 'mysite.com');
  assert.equal(hostOf('https://mysite.com./path'), 'mysite.com');
  assert.equal(hostOf('https://mysite.com'), 'mysite.com');
});

test('classifyUrl: trailing-dot FQDN form matches a first-party origin', () => {
  assert.equal(classifyUrl('https://mysite.com.', ['mysite.com']), 'firstparty');
});
