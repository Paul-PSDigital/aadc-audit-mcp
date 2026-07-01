# aadc-audit-mcp

A **local MCP server** (and CLI) that audits a software project
against the UK ICO **Age Appropriate Design Code** (the Children's
Code, AADC), the statutorily-enforceable framework that governs any
online service "likely to be accessed by children" in the UK.

Runs entirely on your machine over stdio. Your source code never
leaves the device.

## What it does

Twenty MCP tools, all local-only: seventeen individual audits, plus `audit_all`, `list_standards`, and `read_standard`.

| MCP tool | What it does |
|---|---|
| `aadc.audit_all` | Run every audit against a local project root and return one consolidated result. |
| `aadc.audit_permissions` | Inspect iOS `Info.plist` + Android `AndroidManifest.xml` for permissions outside the AADC allowlist. Standards 8, 10. |
| `aadc.audit_sdks` | Inspect `pubspec.yaml` / `package.json` / `requirements.txt` for analytics, advertising, profiling, or tracking SDKs. Standards 5, 9, 12, 13. |
| `aadc.audit_launchurl` | Inspect Dart `launchUrl()` calls and web external-navigation escapes (`window.open`, `location` assignment, `<a target="_blank">`) for outbound links that dump a child into the parent's logged-in browser. Standards 11, 14. |
| `aadc.audit_network_isolation` | Inspect declared protected paths (microphone, camera, on-device-only data) for any network API import. Standard 8. |
| `aadc.audit_defaults` | Heuristic warn-only scan for default-true on suspicious privacy keys (share / track / profile / etc). Standard 7. |
| `aadc.audit_reading_grade` | Heuristic reading-grade check of user-facing copy. Standards 4, 11. |
| `aadc.audit_placeholders` | Flag placeholder content not yet replaced (lorem ipsum, TODO, TBD, dummy text). Standards 4, 6. |
| `aadc.audit_link_reachability` | Warn-only check of external link reachability. Standards 4, 6. |
| `aadc.audit_volume_cap` | Require an explicit volume cap on every audio/video player (Dart players and HTML5 `<audio>`/`<video>` / `new Audio()`). Standards 1, 14. |
| `aadc.audit_sentry_hygiene` | Check Sentry initialisation hygiene (e.g. no PII capture, sane sampling). Standards 7, 9. |
| `aadc.audit_hardcoded_url` | Flag hardcoded URLs outside the CMS, in Dart and web source. Standards 4, 6. |
| `aadc.audit_policy_mentions_sdks` | Warn-only check that the privacy policy names every external-service SDK (Flutter, npm, and Python). Standards 4, 9. |
| `aadc.audit_dpia_present` | Warn-only presence/process heuristic: a DPIA document exists in-repo and is not an obvious unfilled stub (too short, placeholder markers, or missing the core section signals). Standard 2. |
| `aadc.audit_age_assurance` | Warn-only presence/process heuristic: source shows an age-assurance / age-gate mechanism, or you declare a blanket apply-to-all-users stance (`AADC_AGE_STRATEGY=all-users`). Standard 3. |
| `aadc.audit_data_rights_tools` | Warn-only presence/process heuristic: source shows tools for account/data deletion, data export/access, and reporting a concern. Standard 15. |
| `aadc.audit_parent_gate` | Warn-only structural heuristic: once you declare your parent-area paths (`AADC_PARENT_AREA_PATHS`), scans source for a parent/age-gate mechanism and applies a conservative difficulty check (a one-tap "I am over 18" affirm with no birth-year / age / arithmetic challenge warns). No parent-area paths declared reports N/A. Standard 11. |
| `aadc.audit_parent_gate_routes` | Warn-only structural heuristic: once you declare your parent-area paths (`AADC_PARENT_AREA_PATHS`), flags declared parent-area source files that reference no parent gate or route-guard, so they may be reachable directly via a deep link or a direct route. No parent-area paths declared reports N/A. Standard 11. |
| `aadc.list_standards` | Return the 15 AADC standards with their one-line statutory summaries. |
| `aadc.read_standard` | Return the full ICO-published text of one standard. |

The last three audits (`dpia-present`, `age-assurance`, `data-rights-tools`)
are **warn-only presence/process heuristics**. They check that a document or a
recognised signal is *present*, not that it is correct, sufficient, or
prominent. Absence is a WARN (never a FAIL), because the thing they look for
may live server-side, in a dependency, or outside the repository. They cannot
judge the substance of a DPIA, whether age assurance is certain enough for the
risks, or whether a data-rights tool actually works.

### PASS, WARN, FAIL, and N/A

Each audit reports one of four outcomes. An audit that has **zero relevant
inputs to inspect** (a Dart/web audit on a project with none of those files,
or a config-gated audit you haven't enabled) reports `[N/A]`, not a green
`PASS`. **N/A means "not applicable", not "passed"**: "all clean" on a project
whose stack an audit does not cover now reads as N/A so you are never lulled
into reading a non-result as a compliance tick.

N/A never affects the process exit code or the MCP `isError` flag. Only a real
`FAIL` on an applicable audit does. The CLI prints a final tally line of the
exact form:

```
2 passed, 1 warnings, 0 failed, 9 not applicable
```

Each audit result also carries the count of inputs it actually examined
(`scanned N`), and the structured `AuditResult` shape exposes two optional
fields for consumers: `applicable` (boolean) and `scanned` (number).

### Per-stack coverage

Not every audit fires on every stack. This matrix is what gives **real
signal** today. A blank cell is not a failure: it just means that audit
reports N/A on that stack (no inputs to inspect). Read it honestly: a green
run is only meaningful for the audits that actually applied.

| Audit | Flutter / Dart | Web / JS | Native manifest | Python |
|---|:---:|:---:|:---:|:---:|
| permissions | | | yes | |
| sdks | yes | yes | | yes |
| launchurl | yes | yes | | |
| network-isolation | yes | yes | | yes |
| defaults | yes | yes | | yes |
| reading-grade | | | yes (Info.plist rationale) | |
| placeholders | yes | yes | yes | |
| link-reachability | yes | yes | | |
| volume-cap | yes | yes | | |
| sentry-hygiene | yes | yes | | |
| hardcoded-url | yes | yes | | |
| policy-mentions-sdks | yes | yes | | yes |

Notes:

- **Web / JS** means source with a `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`,
  `.tsx`, `.html`, `.htm`, `.vue`, or `.svelte` extension. A vanilla HTML/JS
  PWA now gets real signal: hardcoded URLs in JS/HTML, HTML5 `<audio>` /
  `<video>` or `new Audio()` without an explicit volume clamp, and
  `window.open` / `location` / `<a target="_blank">` external-navigation
  escapes.
- **Native manifest** means iOS `Info.plist` and Android
  `AndroidManifest.xml`, found anywhere in the tree regardless of layout.
- **reading-grade** parses no `.dart` (or `.js`) source at all: its only
  inputs are the iOS `Info.plist` `*UsageDescription` rationale strings
  (shown in the Native-manifest column) and the privacy policy. The privacy
  policy is **config-driven** (any path via `privacyPolicyPath`) and is not
  tied to a stack, so it does not earn a Flutter/Dart cell.
- **sentry-hygiene** only inspects `pubspec.yaml` (`sentry_flutter`) and
  `package.json` (`@sentry/*`), then the Dart / JS / TS init source. It never
  reads `requirements.txt` or the Python `sentry-sdk`, so it reports N/A on a
  Python-only project (hence the blank Python cell).
- **placeholders** scans content and source by extension (see below); that
  set does not include `.py` or `requirements*.txt`, so a Python-only project
  gets no Python-source signal from it (hence the blank Python cell). It still
  fires on any `.md` / `.json` / `.yaml` / `.xml` content a Python repo ships.
- `network-isolation`, `link-reachability`, `sentry-hygiene`, and
  `policy-mentions-sdks` are **config-gated** (see below); they apply to a
  stack only once enabled, otherwise they report N/A.

### Layout-agnostic discovery

`reading-grade` and `policy-mentions-sdks` no longer assume an
`apps/mobile` monorepo layout. They walk the whole project for
`Info.plist` / `pubspec.yaml` / `package.json` / `requirements*.txt`, so any
layout works. `policy-mentions-sdks` recognises npm and Python
external-service SDKs (Sentry, Firebase / Google Analytics, PostHog,
Mixpanel, Amplitude, Segment, Datadog, Hotjar, Stripe, Intercom, and others)
in addition to the Flutter ones.

### Config-gated audits report N/A, not a skipped WARN

Four audits do nothing useful until you point them at something. When they
are not enabled they report `[N/A]` (not a yellow warn-skip), and each N/A
summary names how to switch it on:

- `network-isolation` needs `protectedPaths`.
- `link-reachability` needs `AADC_CHECK_LINKS` (it makes outbound HTTP
  requests, so it is opt-in).
- `policy-mentions-sdks` needs a privacy policy at the configured path.
- `sentry-hygiene` needs a Sentry dependency (`sentry_flutter` or
  `@sentry/*`) in the project.

## Install

```bash
npm install -g aadc-audit-mcp
```

Then add to your MCP client config. For **Claude Code**, edit
`~/.claude.json`:

```json
{
  "mcpServers": {
    "aadc": {
      "command": "aadc"
    }
  }
}
```

For **Claude Desktop**, edit
`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aadc": {
      "command": "aadc"
    }
  }
}
```

That's it. Claude will now offer the twenty `aadc.*` tools whenever
you're working in a project that looks like it might be accessed by
children.

## CLI mode (no MCP needed)

The same binary doubles as a CLI:

```bash
aadc audit ./your-project              # all audits → exit 0 or 1
aadc audit:permissions ./your-project  # one audit
aadc standards                         # list 15 AADC standards
aadc help
```

Useful for GitHub Actions or any CI that doesn't have Claude in the
loop. See `workflows/aadc-ci.yml` for a drop-in.

## Per-project allowlist overrides

Each project has different legitimate dependencies and permissions.
Override via env vars (work for both MCP server and CLI):

```bash
export AADC_PERM_ALLOWLIST_IOS="NSMicrophoneUsageDescription NSBluetoothAlwaysUsageDescription"
export AADC_PERM_ALLOWLIST_ANDROID="android.permission.RECORD_AUDIO ..."
export AADC_SDK_ALLOWLIST_FLUTTER="flutter just_audio webview_flutter ..."
export AADC_SDK_ALLOWLIST_NPM="@cloudflare/workers-types wrangler ..."
export AADC_SDK_ALLOWLIST_PYTHON="fastapi pydantic ..."
export AADC_PROTECTED_PATHS="path/to/sensitive/code/dir ..."
export AADC_TRUSTED_HOSTS="yourapp.com partner.org apps.apple.com ..."
export AADC_FIRST_PARTY_ORIGINS="yourapp.com help.yourapp.com ..."
export AADC_DPIA_PATH="docs/regulations/aadc/DPIA.md"
export AADC_AGE_STRATEGY="all-users"            # or leave unset for age-assurance
export AADC_DATA_RIGHTS_PATHS="lib/account web/src/settings"
export AADC_PRIVACY_POLICY_PATH="docs/privacy-policy.md"

aadc audit .
```

`AADC_DPIA_PATH` points the `dpia-present` audit at the DPIA document if it
does not live at one of the default candidate paths. `AADC_AGE_STRATEGY`
accepts `all-users` (you apply the code's protections to every user, route (b)
of Standard 3) or is left unset to scan for an age-assurance mechanism (route
(a)). `AADC_DATA_RIGHTS_PATHS` narrows the `data-rights-tools` scan to specific
subtrees (space- or comma-separated, relative to the project root).
`AADC_PRIVACY_POLICY_PATH` tells `policy-mentions-sdks` where the privacy
policy lives.

`AADC_TRUSTED_HOSTS` sets the host suffixes the link-reachability
audit will probe. It defaults to common app-store, video, and forms
platforms plus the ICO; supply your own list (your app domains,
partner sites, kit vendors, etc) to override it.

`AADC_FIRST_PARTY_ORIGINS` declares your own site host(s) so a
`launchUrl` / `<a target="_blank">` / `window.open` to your own help
pages is treated as first-party and is not flagged as an external
escape.

The path/value overrides apply to **web source as well as Dart**.
`AADC_PARENT_AREA_PATHS` (env or MCP) declares your parent-only surfaces
(the paths behind the parent gate). It marks post-parent-gate surfaces
that may legitimately open the OS browser (for `launchurl`), and it is
also what enables both Standard 11 structural audits (`parent-gate` and
`parent-gate-routes`); with none declared, those two audits report N/A.
The MCP-only allowlists
`urlExemptPaths` / `urlExemptValues` (for `hardcoded-url`) and
`volumeCapExempt` (for `volume-cap`) now match across `.js` / `.ts` /
`.html` / `.vue` / `.svelte` as well as `.dart`.

When called via MCP, the same overrides can be passed as
`allowlists.{ios,android,flutter,npm,python,protectedPaths,trustedHosts,firstPartyOrigins,parentAreaPaths,urlExemptPaths,urlExemptValues,volumeCapExempt}`
in the tool arguments, useful when Claude is running the audit on
behalf of a project with project-specific allowlists.

## Why MCP, why local, why kid-app-specific

- **Local-only is the whole point.** A compliance tool that uploads
  your source code to a third-party SaaS is a non-starter for a
  kids-app product. The MCP runs as a subprocess on the user's
  machine and never reaches the network.
- **MCP gives Claude (or any MCP-capable AI client) structured
  function calls.** Instead of "Claude reads your repo and tries
  to remember the AADC", Claude calls `aadc.audit_all` and gets a
  machine-shaped result it can paste straight into a PR description,
  GitHub issue, or conformance statement.
- **Kid-app-specific because the existing compliance market is
  enterprise-only.** Paid third-party auditors (TestPros, BBB
  National Programs) start at five figures. Enterprise compliance
  SaaS (OneTrust, Securiti AI) assumes you have a legal team to
  configure them. Small kids apps need a drop-in toolkit. This is
  that toolkit.

## What it doesn't do

- **Doesn't make legal warranties.** Best-effort technical
  scaffolding. A regulator query may still require a paid
  third-party auditor.
- **Doesn't automate the judgement in the judgement-based standards** (1
  best-interests, 2 DPIA, 3 age-appropriate application, 12 profiling, 13
  nudges, 15 online tools). Standards 2, 3, and 15 now have a *presence/process
  heuristic* each (`dpia-present`, `age-assurance`, `data-rights-tools`): they
  warn when an expected document or signal is missing, but they cannot judge
  whether a DPIA is sound, whether age assurance is certain enough for the
  risks, or whether a data-rights tool works and is prominent. Standards 1, 12,
  and 13 have no automated check at all. For the substance of any of these, use
  the conformance-statement template under `templates/` and let Claude fill it
  in by reading your code + the ICO text.

## Repo contents

```
aadc-audit-mcp/
├── README.md, LICENSE
├── package.json, tsconfig.json
├── src/
│   ├── cli.ts                 (dual-mode entry: MCP server OR CLI)
│   ├── server.ts              (MCP server: 20 tools)
│   ├── standards.ts           (ICO AADC text loader)
│   └── audits/                (17 audit modules + support files)
│       ├── index.ts           (registry)
│       ├── types.ts           (AuditResult, AuditOptions)
│       ├── walk.ts            (fs traversal)
│       ├── web-source.ts      (shared web-file discovery + comment stripping)
│       ├── parent-area.ts     (shared Standard 11 parent-area path resolution)
│       ├── permissions.ts     (Standards 8, 10)
│       ├── sdks.ts            (Standards 5, 9, 12, 13)
│       ├── launchurl.ts       (Standards 11, 14)
│       ├── network-isolation.ts (Standard 8)
│       ├── defaults.ts        (Standard 7)
│       ├── reading-grade.ts   (Standards 4, 11)
│       ├── placeholders.ts    (Standards 4, 6)
│       ├── link-reachability.ts (Standards 4, 6)
│       ├── volume-cap.ts      (Standards 1, 14)
│       ├── sentry-hygiene.ts  (Standards 7, 9)
│       ├── hardcoded-url.ts   (Standards 4, 6)
│       ├── policy-mentions-sdks.ts (Standards 4, 9)
│       ├── dpia-present.ts    (Standard 2, warn-only presence/process)
│       ├── age-assurance.ts   (Standard 3, warn-only presence/process)
│       ├── data-rights-tools.ts (Standard 15, warn-only presence/process)
│       ├── parent-gate.ts     (Standard 11, warn-only structural heuristic)
│       └── parent-gate-routes.ts (Standard 11, warn-only structural heuristic)
├── aadc/                      (canonical ICO text mirror)
│   ├── 1-best-interests-of-the-child.md
│   ├── ... (15 standards + executive summary)
│   └── fetch.sh               (refresh from ico.org.uk)
├── templates/
│   ├── AUDIT.md
│   ├── conformance-statement.md
│   ├── privacy-policy.md
│   └── incident-response.md
├── workflows/
│   └── aadc-ci.yml            (drop-in GitHub Actions workflow)
├── examples/
│   └── README.md              (per-language overrides cookbook)
├── tests/                     (node:test suite + tests/fixtures/ project trees;
│                               tests/run.mjs is a dependency-free self-test
│                               covering the three new presence/process audits)
└── legacy-bash/
    └── ...                    (original bash implementation; kept for
                                projects that can't depend on Node)
```

## Related jurisdictions

The 15 standards are broadly aligned with the new US state laws
modelled on the UK AADC (California, South Carolina, Vermont,
Nebraska, Maryland as of 2026). The audits here are a good starting
point in those jurisdictions, but state-specific deltas should be
reviewed separately.

## Licence

MIT. The ICO Children's Code text mirrored under `aadc/` is
published under the Open Government Licence v3.0. See `LICENSE`.

## Development

```bash
npm run build   # compile src/ to dist/ via tsconfig.json
npm test        # compile via tsconfig.test.json and run the suite
```

`npm test` compiles the tests with `tsconfig.test.json` and runs
`node:test` against fixture project trees under `tests/fixtures/`, then
runs `tests/run.mjs`, a dependency-free self-test that checks the three
presence/process audits (`dpia-present`, `age-assurance`,
`data-rights-tools`) against their own fixtures. Both add no new
dependencies (they use only Node built-ins), so they run anywhere the
tool itself runs. `npm run test:selftest` runs just the self-test.

## Contributing

The most useful contributions:

- More language adapters (the audits cover Flutter, Node, Python, and
  vanilla web/JS today; React Native specifics, iOS-Swift-only,
  Android-Kotlin-only, .NET MAUI would all help).
- New checks aligned to AADC standards we haven't automated
  (Standard 13 nudge-pattern detector especially).
- Diff-against-ICO improvements to `aadc/fetch.sh` so wording drift
  surfaces as a structured PR.
- More fixtures under `tests/fixtures/` covering stacks and edge cases
  the current suite doesn't.

Open issues / PRs at
<https://github.com/Paul-PSDigital/aadc-audit-mcp>.
# aadc-audit-mcp
