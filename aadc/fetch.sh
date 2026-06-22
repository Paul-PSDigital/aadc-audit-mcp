#!/usr/bin/env bash
# Refresh the local mirror of the UK ICO Age Appropriate Design Code.
#
# Run this at least annually and
# diff the result against the previous committed state to catch any
# updates the ICO has made to the Code wording.
#
# Output: the 15 standards plus index pages are re-written in place.
# The commit author runs `git diff docs/regulations/aadc/` to see what
# changed and propagates anything material into AUDIT.md.

set -euo pipefail

cd "$(dirname "$0")"

base="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services"
ua="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

slugs=(
  "executive-summary"
  "standards-of-age-appropriate-design"
  "1-best-interests-of-the-child"
  "2-data-protection-impact-assessments"
  "3-age-appropriate-application"
  "4-transparency"
  "5-detrimental-use-of-data"
  "6-policies-and-community-standards"
  "7-default-settings"
  "8-data-minimisation"
  "9-data-sharing"
  "10-geolocation"
  "11-parental-controls"
  "12-profiling"
  "13-nudge-techniques"
  "14-connected-toys-and-devices"
  "15-online-tools"
)

if ! command -v pandoc >/dev/null 2>&1; then
  echo "pandoc not installed. brew install pandoc" >&2
  exit 1
fi

for slug in "${slugs[@]}"; do
  out="${slug}.md"
  curl -sL --user-agent "$ua" --header "Accept: text/html" "${base}/${slug}/" \
    | python3 -c "
import re, sys
html = sys.stdin.read()
m = re.search(r'(<div\s+class=\"prose prose-sm md:prose-base[^\"]*\"[^>]*>)(.*?)</div>\s*</div>\s*</section>', html, re.S)
if not m:
    m = re.search(r'(<div\s+class=\"prose prose-sm md:prose-base[^\"]*\"[^>]*>)(.*?)<footer', html, re.S)
body = m.group(2) if m else html
body = re.sub(r'<script.*?</script>', '', body, flags=re.S)
body = re.sub(r'<style.*?</style>', '', body, flags=re.S)
sys.stdout.write(body)
" \
    | pandoc -f html -t gfm --wrap=none 2>/dev/null > "$out"
  echo "  fetched $slug"
  sleep 0.3
done

echo ""
echo "Done. Run:"
echo "  git diff docs/regulations/aadc/"
echo "to see what (if anything) the ICO has changed since last fetch."
