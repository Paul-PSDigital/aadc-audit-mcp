// AADC Standards 8 (data minimisation) + 10 (geolocation off by default).
//
// Walks iOS Info.plist files and Android AndroidManifest.xml files,
// extracts every declared permission / usage-description, and flags any
// not on the AADC-safe allowlist.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { AuditFinding, AuditOptions, AuditResult } from './types.js';
import { walk } from './walk.js';

const DEFAULT_IOS_ALLOWLIST = [
  'NSMicrophoneUsageDescription',
  'NSBluetoothAlwaysUsageDescription',
  'NSBluetoothPeripheralUsageDescription',
  'NSLocalNetworkUsageDescription',
];

const DEFAULT_ANDROID_ALLOWLIST = [
  'android.permission.RECORD_AUDIO',
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.WAKE_LOCK',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
];

export async function auditPermissions(opts: AuditOptions): Promise<AuditResult> {
  const iosAllow = new Set(opts.allowlists?.ios ?? DEFAULT_IOS_ALLOWLIST);
  const androidAllow = new Set(opts.allowlists?.android ?? DEFAULT_ANDROID_ALLOWLIST);
  const findings: AuditFinding[] = [];

  // ---- iOS ----
  for (const plist of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('/Info.plist'),
  })) {
    let body: string;
    try {
      body = readFileSync(plist, 'utf8');
    } catch {
      continue;
    }
    const matches = body.matchAll(/<key>([A-Za-z]+UsageDescription)<\/key>/g);
    for (const m of matches) {
      const key = m[1];
      if (!iosAllow.has(key)) {
        findings.push({
          where: `${relative(opts.projectRoot, plist)}`,
          message: `iOS permission not on AADC allowlist: ${key}`,
          standards: [8, 10],
        });
      }
    }
  }

  // ---- Android ----
  for (const manifest of walk(opts.projectRoot, {
    filter: (p) => p.endsWith('/AndroidManifest.xml'),
  })) {
    let body: string;
    try {
      body = readFileSync(manifest, 'utf8');
    } catch {
      continue;
    }
    const matches = body.matchAll(/android:name="(android\.permission\.[A-Z_]+)"/g);
    for (const m of matches) {
      const perm = m[1];
      if (!androidAllow.has(perm)) {
        findings.push({
          where: `${relative(opts.projectRoot, manifest)}`,
          message: `Android permission not on AADC allowlist: ${perm}`,
          standards: [8, 10],
        });
      }
    }
  }

  return {
    id: 'permissions',
    title: 'Native permission allowlist',
    standards: [8, 10],
    severity: findings.length === 0 ? 'pass' : 'fail',
    findings,
    summary:
      findings.length === 0
        ? 'Every declared native permission is on the AADC allowlist.'
        : `${findings.length} permission(s) outside the AADC allowlist. ` +
          `Justify each in the conformance statement or remove.`,
  };
}
