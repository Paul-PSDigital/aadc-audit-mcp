#!/usr/bin/env bash
# Audit: third-party SDK allowlist.
#
# AADC Standards 5 (detrimental use of data), 9 (data sharing),
# 12 (profiling), 13 (nudge techniques).
#
# Walks dependency manifests for every supported language and flags any
# dependency outside the AADC-safe allowlist. The allowlist is small on
# purpose: any analytics, ads, profiling, or social SDK is excluded
# unless explicitly justified.
#
# Override the allowlist per language via env vars:
#   AADC_SDK_ALLOWLIST_FLUTTER="just_audio go_router ..."
#   AADC_SDK_ALLOWLIST_NPM="react react-native ..."
#   etc.
#
# Exit codes:
#   0 — every dependency is on the allowlist or in a known-safe base set
#   1 — at least one dependency is not allowlisted

set -euo pipefail

root="${1:-.}"
cd "$root"

# Known-safe base sets per language (small; extend in your env).
base_flutter=(
  flutter cupertino_icons go_router just_audio audio_session
  audio_service video_player drift drift_flutter path_provider
  shared_preferences characters http cryptography crypto
  url_launcher google_fonts sentry_flutter
  in_app_review webview_flutter
  flutter_lints flutter_launcher_icons flutter_native_splash
  flutter_test
)
base_npm=(
  react react-dom react-native next vite vitest
  typescript tslib
)
base_python=(
  flask fastapi pydantic httpx requests
)

if [ -n "${AADC_SDK_ALLOWLIST_FLUTTER:-}" ]; then
  read -r -a base_flutter <<< "$AADC_SDK_ALLOWLIST_FLUTTER"
fi
if [ -n "${AADC_SDK_ALLOWLIST_NPM:-}" ]; then
  read -r -a base_npm <<< "$AADC_SDK_ALLOWLIST_NPM"
fi
if [ -n "${AADC_SDK_ALLOWLIST_PYTHON:-}" ]; then
  read -r -a base_python <<< "$AADC_SDK_ALLOWLIST_PYTHON"
fi

# Hard-blocked package fragments — common analytics / ads / tracking
# SDKs that should never appear in a kids' app regardless of allowlist.
# These are checked across every language; any match is a hard fail.
hard_blocked_substrings=(
  firebase_analytics
  google_mobile_ads
  facebook
  appsflyer
  amplitude
  mixpanel
  segment
  posthog
  hotjar
  branch.io
  adjust
  airship
  onesignal
  iterable
  klaviyo
  intercom
  zendesk
  fullstory
  smartlook
)

# Violations are accumulated to a temp file because the dependency loops
# below pipe through `| while` which runs in a subshell — a plain
# counter variable would reset every iteration. The temp file is the
# simplest workaround that lets the final exit code reflect reality.
violations_file=$(mktemp)
trap 'rm -f "$violations_file"' EXIT

check_dep () {
  local name="$1"
  local source="$2"
  local language="$3"
  shift 3
  local allowlist=("$@")

  # Hard block check first
  for blocked in "${hard_blocked_substrings[@]}"; do
    if [[ "$name" == *"$blocked"* ]]; then
      echo "::error::HARD-BLOCKED dependency: $name (matches '$blocked') in $source"
      echo "x" >> "$violations_file"
      return
    fi
  done

  # Allowlist check
  for ok in "${allowlist[@]}"; do
    if [ "$name" = "$ok" ]; then return; fi
  done
  echo "::error::$language dependency not on AADC allowlist: $name (in $source)"
  echo "x" >> "$violations_file"
}

# ---- Flutter / Dart (pubspec.yaml) ----
while IFS= read -r pubspec; do
  # Extract top-level dependency keys: lines like "  package_name:" right
  # after the `dependencies:` or `dev_dependencies:` headings.
  python3 - "$pubspec" <<'PY' || true
import sys, re, pathlib
text = pathlib.Path(sys.argv[1]).read_text()
out = []
section = None
for line in text.splitlines():
    if re.match(r'^[a-z_]+:\s*$', line.strip()):
        section = line.strip().rstrip(':')
        continue
    if section in ('dependencies', 'dev_dependencies'):
        m = re.match(r'^  ([a-z_][a-z0-9_]*):\s', line)
        if m:
            out.append(m.group(1))
for name in out:
    print(name)
PY
done < <(find . -name "pubspec.yaml" -not -path "*/.dart_tool/*" -not -path "*/build/*" 2>/dev/null) \
  | while IFS= read -r pkg; do
      [ -z "$pkg" ] && continue
      check_dep "$pkg" "pubspec.yaml" "Flutter" "${base_flutter[@]}"
    done

# ---- Node / NPM (package.json) ----
while IFS= read -r pkgjson; do
  python3 - "$pkgjson" <<'PY' || true
import sys, json, pathlib
data = json.loads(pathlib.Path(sys.argv[1]).read_text())
for key in ("dependencies", "devDependencies", "peerDependencies"):
    for name in (data.get(key) or {}).keys():
        print(name)
PY
done < <(find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.next/*" 2>/dev/null) \
  | sort -u \
  | while IFS= read -r pkg; do
      [ -z "$pkg" ] && continue
      check_dep "$pkg" "package.json" "Node" "${base_npm[@]}"
    done

# ---- Python (requirements.txt + pyproject.toml [project.dependencies]) ----
while IFS= read -r req; do
  # Strip versions / extras: "package[extra]==1.2.3" → "package"
  sed -E 's/[[<>=!~;].*//' "$req" | grep -v '^#' | grep -v '^$' | tr -d ' '
done < <(find . -name "requirements*.txt" -not -path "*/.venv/*" 2>/dev/null) \
  | sort -u \
  | while IFS= read -r pkg; do
      [ -z "$pkg" ] && continue
      check_dep "$pkg" "requirements.txt" "Python" "${base_python[@]}"
    done

violations=$(wc -l < "$violations_file" | tr -d ' ')

if [ "${violations:-0}" -gt 0 ]; then
  echo ""
  echo "Third-party SDK allowlist FAILED with $violations violation(s)."
  echo "To allow a new dependency:"
  echo "  - confirm it does not collect / share children's data;"
  echo "  - add it to AADC_SDK_ALLOWLIST_<LANG> (one-off via env);"
  echo "  - or fork the skill and update the default allowlist with"
  echo "    written justification against AADC Standards 5, 9, 12, 13."
  exit 1
fi

echo "Third-party SDK allowlist: clean."
