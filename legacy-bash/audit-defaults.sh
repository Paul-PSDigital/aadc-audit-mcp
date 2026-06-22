#!/usr/bin/env bash
# Audit: privacy-positive defaults.
#
# AADC Standard 7 (default settings).
#
# Scans code for declarations of persisted settings whose default value
# would expose a child without an explicit opt-in. This is heuristic by
# nature; the audit lists every match for human review rather than
# claiming to find every violation.
#
# Patterns flagged:
#   - any boolean default true for a key matching /share|track|analytics|ads|location|profile|personalisation/
#   - any feature flag with `production: true` for a key matching the same
#
# Override the suspicious key regex via env:
#   AADC_DEFAULT_KEY_REGEX='share|track|analytics|...'
#
# Exit code is informational (always 0); the audit just produces a
# report. Human review against the conformance statement decides
# whether each flagged item is an actual problem.

set -euo pipefail

root="${1:-.}"
cd "$root"

regex="${AADC_DEFAULT_KEY_REGEX:-share|track|analytics|ads|advertising|location|profile|profiling|personali[sz]ation|recommend|social|nudge}"

echo "Scanning for suspicious privacy defaults..."
echo "Regex: $regex"
echo ""

# Dart: anything that looks like `someShareThing = true` or
# default_value: true tagged with a suspicious key.
echo "Dart defaults to review:"
grep -rnE "(default_value|defaultValue|default)\s*[:=]\s*true" \
  --include="*.dart" \
  --exclude-dir=.dart_tool --exclude-dir=build . 2>/dev/null \
  | grep -iE "$regex" || echo "  (none)"

echo ""
echo "JSON / YAML feature flags with production: true on a suspicious key:"
grep -rnE "production.*[:=]\s*true" \
  --include="*.json" --include="*.yaml" --include="*.yml" --include="*.mjs" --include="*.js" --include="*.ts" \
  --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null \
  | grep -iE "$regex" || echo "  (none)"

echo ""
echo "Defaults audit complete. Manually review each flagged line"
echo "against AADC Standard 7 — defaults must be privacy-positive."
exit 0
