#!/usr/bin/env bash
# One-shot install: copy the skill's scaffolding into a target project.
#
# Usage:
#   /path/to/aadc-audit-mcp/legacy-bash/install.sh /path/to/your/project
#
# Idempotent: re-running won't overwrite a user-edited AUDIT.md or
# privacy policy. The canonical ICO text under aadc/ IS refreshed.

set -euo pipefail

skill_dir="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:-}"
if [ -z "$target" ]; then
  echo "Usage: $0 <target-project-root>"
  exit 1
fi
target="$(cd "$target" && pwd)"

echo "Installing aadc-audit-mcp into: $target"

mkdir -p "$target/docs/regulations/aadc"
mkdir -p "$target/docs/handover"
mkdir -p "$target/tools/aadc"
mkdir -p "$target/.github/workflows"

echo "  - copying canonical ICO text → docs/regulations/aadc/"
cp -R "$skill_dir/aadc/." "$target/docs/regulations/aadc/"

echo "  - copying audit scripts → tools/aadc/"
cp "$skill_dir/scripts/audit-permissions.sh"        "$target/tools/aadc/"
cp "$skill_dir/scripts/audit-sdks.sh"               "$target/tools/aadc/"
cp "$skill_dir/scripts/audit-launchurl.sh"          "$target/tools/aadc/"
cp "$skill_dir/scripts/audit-network-isolation.sh"  "$target/tools/aadc/"
cp "$skill_dir/scripts/audit-defaults.sh"           "$target/tools/aadc/"
cp "$skill_dir/scripts/audit.sh"                    "$target/tools/aadc/"
chmod +x "$target/tools/aadc/"*.sh

echo "  - copying GitHub Actions workflow → .github/workflows/"
if [ ! -f "$target/.github/workflows/aadc-ci.yml" ]; then
  cp "$skill_dir/workflows/aadc-ci.yml" "$target/.github/workflows/aadc-ci.yml"
else
  echo "    (skipped: .github/workflows/aadc-ci.yml already exists)"
fi

echo "  - copying templates (only if missing)"
for f in AUDIT.md conformance-statement.md privacy-policy.md incident-response.md; do
  dest="$target/docs/handover/$f"
  if [ ! -f "$dest" ]; then
    cp "$skill_dir/templates/$f" "$dest"
    echo "    - placed $f"
  else
    echo "    - skipped $f (already exists)"
  fi
done

echo ""
echo "Done. Next steps:"
echo "  1. Fill in docs/handover/conformance-statement.md with your"
echo "     project's specifics (judgement-based standards)."
echo "  2. Run tools/aadc/audit.sh to populate"
echo "     docs/regulations/aadc/AUDIT.md."
echo "  3. Commit + push; the CI workflow will keep checks running on"
echo "     every PR going forward."
