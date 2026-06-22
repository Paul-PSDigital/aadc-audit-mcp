#!/usr/bin/env bash
# Audit: network isolation in must-not-network code paths.
#
# AADC Standard 8 (data minimisation).
#
# Some code paths must never network — a kids' app that captures
# microphone audio for live-listen must not upload that audio, a
# camera viewfinder must not screenshot to remote, an on-device
# scoring engine must not phone home. This audit fails the build
# if any file in a declared "must-not-network" path imports a
# network API.
#
# Set the protected paths via the second arg, or via env:
#   AADC_PROTECTED_PATHS="lib/features/microphone lib/features/camera"
#
# Set the forbidden API regex via env:
#   AADC_FORBIDDEN_NETWORK_APIS='package:http/|package:dio/|HttpClient|...'
#
# Exit codes:
#   0 — every protected file is free of network-API imports
#   1 — at least one protected file imports a network API

set -euo pipefail

root="${1:-.}"
shift || true
cd "$root"

protected_csv="${1:-${AADC_PROTECTED_PATHS:-}}"

if [ -z "$protected_csv" ]; then
  echo "Usage: $0 <project-root> '<comma-or-space-separated-paths>'"
  echo "  or set AADC_PROTECTED_PATHS env var"
  echo "  e.g. AADC_PROTECTED_PATHS='lib/features/microphone lib/services/microphone_service.dart'"
  exit 2
fi

# Default forbidden patterns. Covers Dart, Swift, Kotlin, Java, JS/TS,
# Python, Rust, Go, Ruby, .NET — cross-language.
default_forbidden='package:http/|package:dio/|dart:io.*HttpClient|Sentry\.capture|FirebaseCrashlytics|http\.post\(|http\.get\(|URLSession|URLRequest|HttpURLConnection|java\.net\.URL|fetch\(|XMLHttpRequest|axios|node-fetch|got\.|got\(|urllib|requests\.|reqwest::|net/http|HttpClient'
forbidden="${AADC_FORBIDDEN_NETWORK_APIS:-$default_forbidden}"

violations=0

# Normalise the paths list (support both comma and space separators)
paths=()
for token in $(echo "$protected_csv" | tr ',' ' '); do
  [ -z "$token" ] && continue
  paths+=("$token")
done

for target in "${paths[@]}"; do
  if [ -e "$target" ]; then
    matches=$(grep -rnE "$forbidden" "$target" 2>/dev/null || true)
    if [ -n "$matches" ]; then
      echo "::error::Network API found in protected path '$target':"
      echo "$matches"
      violations=$((violations + 1))
    fi
  fi
done

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "Network-isolation audit FAILED."
  echo "The flagged code path is declared off-network for AADC data-"
  echo "minimisation reasons. If a network call genuinely belongs here,"
  echo "either update the protected-paths list (with written"
  echo "justification in the conformance statement) or move the call"
  echo "to a non-protected module."
  exit 1
fi

echo "Network-isolation audit: clean across ${#paths[@]} protected path(s)."
