# aadc-audit-mcp

A **local MCP server** (and CLI) that audits a software project
against the UK ICO **Age Appropriate Design Code** (the Children's
Code, AADC), the statutorily-enforceable framework that governs any
online service "likely to be accessed by children" in the UK.

Runs entirely on your machine over stdio. Your source code never
leaves the device.

## What it does

Fifteen MCP tools, all local-only: twelve individual audits, plus `audit_all`, `list_standards`, and `read_standard`.

| MCP tool | What it does |
|---|---|
| `aadc.audit_all` | Run every audit against a local project root and return one consolidated result. |
| `aadc.audit_permissions` | Inspect iOS `Info.plist` + Android `AndroidManifest.xml` for permissions outside the AADC allowlist. Standards 8, 10. |
| `aadc.audit_sdks` | Inspect `pubspec.yaml` / `package.json` / `requirements.txt` for analytics, advertising, profiling, or tracking SDKs. Standards 5, 9, 12, 13. |
| `aadc.audit_launchurl` | Inspect Dart `launchUrl()` calls for missing `LaunchMode.externalApplication`. Catches the "child taps a link, lands in the parent's logged-in browser" trap. Standards 11, 14. |
| `aadc.audit_network_isolation` | Inspect declared protected paths (microphone, camera, on-device-only data) for any network API import. Standard 8. |
| `aadc.audit_defaults` | Heuristic warn-only scan for default-true on suspicious privacy keys (share / track / profile / etc). Standard 7. |
| `aadc.audit_reading_grade` | Heuristic reading-grade check of user-facing copy. Standards 4, 11. |
| `aadc.audit_placeholders` | Flag placeholder content not yet replaced (lorem ipsum, TODO, TBD, dummy text). Standards 4, 6. |
| `aadc.audit_link_reachability` | Warn-only check of external link reachability. Standards 4, 6. |
| `aadc.audit_volume_cap` | Require an explicit volume cap on every audio/video player. Standards 1, 14. |
| `aadc.audit_sentry_hygiene` | Check Sentry initialisation hygiene (e.g. no PII capture, sane sampling). Standards 7, 9. |
| `aadc.audit_hardcoded_url` | Flag hardcoded URLs outside the CMS. Standards 4, 6. |
| `aadc.audit_policy_mentions_sdks` | Warn-only check that the privacy policy names every external-service SDK. Standards 4, 9. |
| `aadc.list_standards` | Return the 15 AADC standards with their one-line statutory summaries. |
| `aadc.read_standard` | Return the full ICO-published text of one standard. |

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

That's it. Claude will now offer the fifteen `aadc.*` tools whenever
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

aadc audit .
```

When called via MCP, the same overrides can be passed as
`allowlists.{ios,android,flutter,npm,python,protectedPaths}` in the
tool arguments — useful when Claude is running the audit on behalf
of a project with project-specific allowlists.

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
  configure them. Small clinical / educational kids apps need a
  drop-in toolkit. This is that toolkit.

## What it doesn't do

- **Doesn't make legal warranties.** Best-effort technical
  scaffolding. A regulator query may still require a paid
  third-party auditor.
- **Doesn't automate the 6 judgement-based standards** (1
  best-interests, 2 DPIA, 3 age-appropriate application, 12
  profiling, 13 nudges, 15 online tools). For those, use the
  conformance-statement template under `templates/` and let Claude
  fill it in by reading your code + the ICO text.

## Repo contents

```
aadc-audit-mcp/
├── README.md, LICENSE
├── package.json, tsconfig.json
├── src/
│   ├── cli.ts                 (dual-mode entry: MCP server OR CLI)
│   ├── server.ts              (MCP server: 15 tools)
│   ├── standards.ts           (ICO AADC text loader)
│   └── audits/                (12 audit modules + support files)
│       ├── index.ts           (registry)
│       ├── types.ts           (AuditResult, AuditOptions)
│       ├── walk.ts            (fs traversal)
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
│       └── policy-mentions-sdks.ts (Standards 4, 9)
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

## Contributing

The most useful contributions:

- More language adapters (the audits cover Flutter, Node, Python
  today; React Native specifics, iOS-Swift-only, Android-Kotlin-
  only, .NET MAUI would all help).
- New checks aligned to AADC standards we haven't automated
  (Standard 13 nudge-pattern detector especially).
- Diff-against-ICO improvements to `aadc/fetch.sh` so wording drift
  surfaces as a structured PR.
- Integration tests against a fixture project tree.

Open issues / PRs at
<https://github.com/Paul-PSDigital/aadc-audit-mcp>.
# aadc-audit-mcp
