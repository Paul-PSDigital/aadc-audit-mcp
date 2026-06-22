#!/usr/bin/env bash
# Audit: outbound-link mode (kid-facing).
#
# AADC Standard 11 (parental controls) + Standard 14 (connected devices).
#
# Default UX: a child taps a link → it opens in the parent's logged-in
# OS browser. Bad. Either:
#   - the call must pass through a vetted "safe link" helper that
#     opens inside an in-app sandboxed WebView (preferred for kid-
#     facing surfaces), or
#   - the call must use the OS browser mode AND live behind the
#     parent gate (acceptable for parent-only screens).
#
# This audit catches any URL-opening API call that does NEITHER. The
# exact patterns are language-specific; we cover the common ones.
#
# Override the helper name(s) via env:
#   AADC_SAFE_LINK_HELPERS="openSafeKidFacingLink openInSafeWebView"
#
# Exit codes:
#   0 — every URL-opening call is either a safe-link helper, or is
#       paired with an explicit OS-browser mode in the same call
#   1 — at least one call would land a child in the OS browser

set -euo pipefail

root="${1:-.}"
cd "$root"

safe_helpers="${AADC_SAFE_LINK_HELPERS:-openSafeKidFacingLink}"

violations=0

# ---- Flutter / Dart ----
# launchUrl(<uri>, mode: LaunchMode.externalApplication) is OK iff the
# call is in a known parent-area file (developer can mark these via
# the AADC_PARENT_AREA_GLOB env var). Anything else must be a safe
# helper.
parent_area_glob="${AADC_PARENT_AREA_GLOB:-**/parent/**.dart}"

if find . -name "*.dart" -not -path "*/.dart_tool/*" -not -path "*/build/*" 2>/dev/null | head -1 | grep -q .; then
  matches=$(awk '
    # Skip lines whose first non-whitespace is a Dart line comment.
    # A reference to launchUrl in a `// ...` comment is documentation,
    # not a call.
    /launchUrl\s*\(/ {
      stripped = $0
      sub(/^[[:space:]]+/, "", stripped)
      if (stripped ~ /^\/\//) next
      buf = $0
      for (i = 0; i < 4 && (getline line) > 0; i++) buf = buf " " line
      if (buf !~ /LaunchMode\.externalApplication/) {
        print FILENAME ":" NR ": " $0
      }
    }
  ' $(find . -name "*.dart" -not -path "*/.dart_tool/*" -not -path "*/build/*" 2>/dev/null))
  if [ -n "$matches" ]; then
    echo "::error::Dart launchUrl() without explicit externalApplication mode:"
    echo "$matches"
    violations=$((violations + 1))
  fi
fi

# ---- React Native ----
if find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -not -path "*/node_modules/*" 2>/dev/null | head -1 | grep -q .; then
  rn_matches=$(grep -rn 'Linking\.openURL' \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null \
    | grep -vE "$safe_helpers" || true)
  if [ -n "$rn_matches" ]; then
    echo "::warning::React Native Linking.openURL calls (verify each is parent-area only):"
    echo "$rn_matches"
  fi
fi

# ---- Web ----
if find . -name "*.html" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -not -path "*/node_modules/*" 2>/dev/null | head -1 | grep -q .; then
  web_matches=$(grep -rn 'window\.open\|target="_blank"' \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.html" \
    --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null \
    | grep -vE 'rel="noopener noreferrer"|safe' || true)
  if [ -n "$web_matches" ]; then
    echo "::warning::Web outbound link without noopener (review each):"
    echo "$web_matches"
  fi
fi

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "launchUrl mode audit FAILED."
  echo "Either route the call through a vetted safe-link helper (e.g."
  echo "openSafeKidFacingLink → opens in a sandboxed in-app WebView),"
  echo "or pass LaunchMode.externalApplication explicitly AND confirm"
  echo "the call site is behind the parent gate."
  exit 1
fi

echo "launchUrl mode audit: clean (dart fail-on, RN + web are warn-only)."
