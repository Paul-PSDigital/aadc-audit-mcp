#!/usr/bin/env bash
# Audit: native permission allowlist.
#
# AADC Standards 8 (data minimisation) + 10 (geolocation off by default).
#
# Walks iOS Info.plist files and Android AndroidManifest.xml files,
# extracts every declared permission / usage-description, and flags any
# that is not on the AADC-safe allowlist.
#
# The allowlist defaults to the minimum needed for a kids' audio app:
# microphone (for any live-listen feature), Bluetooth, and the audio /
# foreground-service permissions necessary for media playback. Override
# by setting:
#   AADC_PERM_ALLOWLIST_IOS="NSMicrophoneUsageDescription NSBluetoothAlwaysUsageDescription"
#   AADC_PERM_ALLOWLIST_ANDROID="android.permission.RECORD_AUDIO ..."
#
# Exit codes:
#   0 — every declared permission is on the allowlist
#   1 — at least one declared permission is NOT on the allowlist

set -euo pipefail

root="${1:-.}"
cd "$root"

default_ios=(
  NSMicrophoneUsageDescription
  NSBluetoothAlwaysUsageDescription
  NSBluetoothPeripheralUsageDescription
  NSLocalNetworkUsageDescription
)
default_android=(
  android.permission.RECORD_AUDIO
  android.permission.BLUETOOTH
  android.permission.BLUETOOTH_ADMIN
  android.permission.BLUETOOTH_CONNECT
  android.permission.BLUETOOTH_SCAN
  android.permission.MODIFY_AUDIO_SETTINGS
  android.permission.WAKE_LOCK
  android.permission.FOREGROUND_SERVICE
  android.permission.FOREGROUND_SERVICE_MICROPHONE
  android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK
  android.permission.INTERNET
  android.permission.ACCESS_NETWORK_STATE
)

# Allow override via env var (space-separated)
if [ -n "${AADC_PERM_ALLOWLIST_IOS:-}" ]; then
  read -r -a default_ios <<< "$AADC_PERM_ALLOWLIST_IOS"
fi
if [ -n "${AADC_PERM_ALLOWLIST_ANDROID:-}" ]; then
  read -r -a default_android <<< "$AADC_PERM_ALLOWLIST_ANDROID"
fi

violations=0

# ---- iOS ----
while IFS= read -r plist; do
  [ -z "$plist" ] && continue
  # Extract every key that ends in "UsageDescription" — these are the
  # permission strings Apple shows the user. grep returns non-zero
  # when no matches; that's fine, just means this plist has no
  # permission keys, so `|| true` to keep the script alive.
  keys=$(grep -oE '<key>[A-Za-z]+UsageDescription</key>' "$plist" 2>/dev/null \
    | sed -E 's#<key>([A-Za-z]+UsageDescription)</key>#\1#' \
    || true)
  for key in $keys; do
    allowed=0
    for ok in "${default_ios[@]}"; do
      if [ "$key" = "$ok" ]; then allowed=1; break; fi
    done
    if [ "$allowed" = 0 ]; then
      echo "::error::iOS permission not on AADC allowlist: $key (in $plist)"
      violations=$((violations + 1))
    fi
  done
done < <(find . -name "Info.plist" -not -path "*/Pods/*" -not -path "*/build/*" 2>/dev/null)

# ---- Android ----
while IFS= read -r manifest; do
  [ -z "$manifest" ] && continue
  perms=$(grep -oE 'android:name="android\.permission\.[A-Z_]+"' "$manifest" 2>/dev/null \
    | sed -E 's#android:name="([^"]+)"#\1#' \
    || true)
  for perm in $perms; do
    allowed=0
    for ok in "${default_android[@]}"; do
      if [ "$perm" = "$ok" ]; then allowed=1; break; fi
    done
    if [ "$allowed" = 0 ]; then
      echo "::error::Android permission not on AADC allowlist: $perm (in $manifest)"
      violations=$((violations + 1))
    fi
  done
done < <(find . -name "AndroidManifest.xml" -not -path "*/build/*" 2>/dev/null)

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "Native permission allowlist FAILED with $violations violation(s)."
  echo "To allow a new permission, either:"
  echo "  - extend AADC_PERM_ALLOWLIST_IOS / _ANDROID env vars (one-off);"
  echo "  - or fork the skill and update the default allowlists with"
  echo "    justification documented against AADC Standards 8 + 10."
  exit 1
fi

echo "Native permission allowlist: clean."
