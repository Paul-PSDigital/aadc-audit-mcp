# Changelog

All notable changes to `aadc-audit-mcp`, in reverse-chronological
order. Where a release fixes a bug we shipped, the entry explains how
the bug got there in the first place. The maintenance principle of
this project is "be honest about what the audit missed and why."

The format follows [Keep a Changelog](https://keepachangelog.com/),
the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.3] - 2026-07-01

### Added

- **Two new structural Standard 11 (parental controls) sub-audits**, each
  registered, exposed as an individual MCP tool, and runnable as a CLI
  subcommand. Both are **warn-only** and both require you to declare your
  parent-area paths (`AADC_PARENT_AREA_PATHS` or
  `allowlists.parentAreaPaths`); with none declared, each reports N/A rather
  than guessing.
  - `parent-gate` (`aadc.audit_parent_gate`): checks that a parent/age-gate
    mechanism exists in source (gate existence) and applies a conservative
    difficulty heuristic. A gate that shows only a trivial one-tap "I am over
    18" affirm, with no birth-year / age-entry / arithmetic / free-text
    challenge anywhere, warns. Standard 11.
  - `parent-gate-routes` (`aadc.audit_parent_gate_routes`): checks that every
    declared parent-area source file references a parent gate or a route-guard,
    so a parent-only surface is not reachable directly via a deep link or a
    direct route (deep-link / route-guard protection). Standard 11.

  The MCP server now exposes 20 tools total: the 17 individual audits plus
  `aadc.audit_all`, `aadc.list_standards`, and `aadc.read_standard`.

### Honesty notes

- These are structural heuristics, not proof. `parent-gate` detects a gate's
  PRESENCE plus a best-effort difficulty signal; it cannot confirm the gate is
  actually wired up to block navigation. The difficulty check is deliberately
  tuned to avoid false alarms: it warns only on a clear trivial-affirm signal
  with no strong challenge, so it can MISS a weak gate rather than over-warn.
- Gate PERSISTENCE across sessions (whether a passed gate is remembered,
  re-challenged, or trivially re-passable) is runtime behaviour that is out of
  structural reach and remains a manual / judgement item, not covered by either
  audit.
- For `parent-gate-routes`, a referenced guard token is not proof the guard is
  wired correctly, and its absence in a given file can be a false positive when
  the gate is applied centrally by a parent router or layout file. Treat
  findings as prompts to confirm route protection by hand.

## [0.3.2] - 2026-06-26

### Added

- **Three new warn-only audits for previously-uncovered standards**, each
  registered, exposed as an individual MCP tool, and runnable as a CLI
  subcommand:
  - `dpia-present` (`aadc.audit_dpia_present`): checks that a DPIA document
    exists in-repo and is not an obvious unfilled stub (too short, placeholder
    markers, or missing the core section signals). Standard 2.
  - `age-assurance` (`aadc.audit_age_assurance`): checks for an age-assurance /
    age-gate signal in source, or a declared apply-to-all-users stance
    (`AADC_AGE_STRATEGY=all-users`). Standard 3.
  - `data-rights-tools` (`aadc.audit_data_rights_tools`): checks source for
    account/data deletion, data export/access, and a report-a-concern route.
    Standard 15.

  The MCP server now exposes 18 tools total: the 15 individual audits plus
  `aadc.audit_all`, `aadc.list_standards`, and `aadc.read_standard`.
- **A dependency-free self-test harness for the three new audits.**
  `tests/run.mjs` runs each new audit against a tiny isolated fixture project
  under `tests/fixtures/` (`dpia-present/`, `age-assurance/`,
  `data-rights-tools/`) and asserts the expected severity, using only Node
  built-ins. It is wired into `npm test` (which already runs in CI on Node 18,
  20, and 22) and is also available on its own as `npm run test:selftest`.
- **New string-valued options, wired through both entrypoints.** `opts.options`
  is now plumbed from the CLI (`AADC_DPIA_PATH`, `AADC_AGE_STRATEGY`,
  `AADC_DATA_RIGHTS_PATHS`, `AADC_PRIVACY_POLICY_PATH`) and from MCP callers
  (the tool `options` object), so per-audit path/strategy overrides reach the
  audits over both transports.

### Why this matters (the honesty entry)

Standards 2, 3, and 15 had no automated check before this release. They now
have one each, but each is a **presence/process heuristic**: it confirms that a
document or a recognised signal is *present*, not that it is correct,
sufficient, or prominent. That is why all three are warn-only and never FAIL.
A missing DPIA file is not proof no DPIA exists (it may live in Confluence or a
compliance system); a missing age or data-rights signal may be implemented
server-side or under names the scan does not recognise. These audits cannot
judge the substance of a DPIA, whether age assurance is certain enough for the
risks, or whether a data-rights tool actually works.

Fixture coverage is honest about its own edges: `tests/run.mjs` currently
covers the three new audits only. The 12 older audits remain covered by the
`node:test` fixture suite added in 0.3.1, which `npm test` still runs first.
Folding the older audits into the same dependency-free harness (or vice versa)
is tracked in `ROADMAP.md`; this release does not claim to do it.

## [0.3.1] - 2026-06-23

### Added

- **Web / JS coverage.** `hardcoded-url`, `volume-cap`, and `launchurl`
  now scan web source (`.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx`,
  `.html`, `.htm`, `.vue`, `.svelte`) in addition to Dart, via a shared
  comment-aware `web-source` module. A vanilla HTML/JS PWA now gets real
  signal: hardcoded outbound URLs, HTML5 `<audio>` / `<video>` or
  `new Audio()` without an explicit volume clamp, and `window.open` /
  `location` / `<a target="_blank">` escapes out of the in-app sandbox.
- **npm and Python service-SDK disclosure.** `policy-mentions-sdks` now
  recognises npm and Python external-service SDKs (Sentry, Firebase /
  Google Analytics, PostHog, Mixpanel, Amplitude, Segment, Datadog,
  Hotjar, Stripe, Intercom, and others), not just Flutter packages.
- **`AADC_FIRST_PARTY_ORIGINS`** (env) / `allowlists.firstPartyOrigins`
  (MCP): declare your own site host(s) so a `launchurl` `target="_blank"`
  or `window.open` to your own pages is not flagged.
- **An adversarial fixture suite and a test runner.** `npm test`
  compiles via `tsconfig.test.json` and runs `node:test` against
  per-audit fixtures under `tests/` (no new dependencies): 60 tests.
- **CI.** `.github/workflows/ci.yml` runs build and test on Node 18, 20,
  and 22 on every push and pull request.

### Changed

- **Not-applicable reporting.** `AuditResult` gains optional `applicable`
  and `scanned` fields. An audit with zero relevant inputs (a Dart/web
  check on a project with none of those files, or a config-gated audit
  you have not enabled) now reports `[N/A]` instead of a green `PASS`,
  and the CLI prints a `N passed, N warnings, N failed, N not applicable`
  tally. N/A never affects the exit code or the MCP `isError` flag.
  "Not applicable" no longer masquerades as "compliant".
- **Layout-agnostic discovery.** `reading-grade` and
  `policy-mentions-sdks` walk the whole tree for `Info.plist` /
  `pubspec.yaml` / `package.json` / `requirements.txt` instead of a
  hardcoded `apps/mobile/` path, so any project layout works.
- **De-tuned for general use.** Removed identifiers and vocabulary
  specific to one reference app (private domains, filenames, the
  `uiStrings` CMS convention) and clinical/medical flavour from the
  code, docs, and templates.

### Fixed

- An adversarial review pass found and fixed five correctness bugs, each
  now locked by a regression test: an npm `@sentry/*` app could never
  pass (the init check was Dart-only); the `TODO` placeholder scan was
  case-insensitive and flagged the ordinary word "todo"; expanded-form
  `pubspec.yaml` dependencies bypassed the analytics hard-block; the
  comment stripper mishandled JS regex literals (dropping a real URL or
  leaking a commented one); and protocol-relative `//host` navigations
  slipped past `launchurl`.

### Why this matters (the honesty entry)

The 0.3.0 entry admitted its seven audits shipped without paired
fixtures, which by this project's own maintenance principle made them
unprovable. 0.3.1 closes that gap: every audit now has at least one
adversarial fixture, CI runs them on every push, and the audits were put
through a deliberate false-positive hunt before release (which itself
surfaced the five bugs fixed above). The coverage is still heuristic and
still does not touch the semantic standards (1, 12, 13), which remain
`ROADMAP.md` work. But "all clean" now means "the checks that applied
found nothing", with everything else shown as N/A rather than a
misleading green.

## [0.3.0] - 2026-06-22

### Added

- **Seven additional audits**, each now present in the registry and
  exposed both as an individual MCP tool and as a CLI subcommand:
  - `reading-grade` (`aadc.audit_reading_grade`): heuristic
    reading-grade check of user-facing copy. Standards 4, 11.
  - `placeholders` (`aadc.audit_placeholders`): placeholder content
    not yet replaced. Standards 4, 6.
  - `link-reachability` (`aadc.audit_link_reachability`): warn-only
    external link reachability. Standards 4, 6.
  - `volume-cap` (`aadc.audit_volume_cap`): explicit volume cap on
    every audio/video player. Standards 1, 14.
  - `sentry-hygiene` (`aadc.audit_sentry_hygiene`): Sentry
    initialisation hygiene. Standards 7, 9.
  - `hardcoded-url` (`aadc.audit_hardcoded_url`): hardcoded URLs
    outside the CMS. Standards 4, 6.
  - `policy-mentions-sdks` (`aadc.audit_policy_mentions_sdks`):
    warn-only check that the privacy policy names every
    external-service SDK. Standards 4, 9.

  The MCP server now exposes 15 tools total: the 12 individual
  audits plus `aadc.audit_all`, `aadc.list_standards`, and
  `aadc.read_standard`.

### Changed

- **Registry-driven MCP tool dispatch.** The server now derives its
  per-audit tools from the audit registry rather than a hand-kept
  list, so a new audit added to the registry surfaces as an MCP tool
  and a CLI subcommand automatically.
- **Version reconciled.** `package.json` had been left at `0.1.0`
  while `0.2.0` was already documented here. This release brings the
  package version and the changelog back into agreement at `0.3.0`.

### Why this matters (the honesty entry)

These seven new audits broaden coverage, but they do **not** yet have
paired adversarial fixtures. Per this project's maintenance principle,
an audit without a fixture is a promise we can't prove we keep: it
will silently pass anything its author didn't anticipate, exactly the
failure mode the v0.1 to v0.2 Safari-leak story documents. Fixtures
for every audit (including these seven) remain a `ROADMAP.md` item,
not something shipped in 0.3.0.

## [0.2.0] - 2026-05-22

### Changed

- **`aadc.audit_launchurl` now FAILS on any `launchUrl()` call in a
  kid-facing Dart file**, regardless of whether
  `LaunchMode.externalApplication` is set. Previously the audit only
  required external mode (the old "in-app WebView leaks cookies"
  threat model) and would happily pass code that dumped a child into
  the parent's logged-in OS browser.

  Consumers now declare their parent-area paths via
  `AADC_PARENT_AREA_PATHS` (or `opts.allowlists.parentAreaPaths`).
  Files inside those paths may use `launchUrl(external)`. Every
  other Dart file must use the project's safe-link helper (an in-app
  sandboxed WebView) instead.

### Why this matters (the honesty entry)

The original v0.1 launchUrl check was written when in-app WebView
cookie inheritance was the dominant outbound-link threat for kid
apps. When the reference consumer's codebase added a sandboxed
WebView for kid-facing links (flipping the threat model so that
`LaunchMode.externalApplication` itself became the unsafe option in
kid-facing surfaces) the audit didn't flip with it.

In a manual adversarial test, a deliberately-planted call of
`launchUrl(Uri.parse('https://www.amazon.co.uk/'),
mode: LaunchMode.externalApplication)` placed inside a kid-facing
file (the Listen tab) passed the audit cleanly. The audit reported
green; the bug was real.

We documented this as v0.1 → v0.2 because the failure mode is the
single most important thing to broadcast about this kind of tool:
**automated audits only catch what the audit was written to look
for.** If the threat model shifts and the audit doesn't, the audit
is a false-positive engine until you notice.

To prevent the same class of regression repeating, v0.2 also
introduces the maintenance principle:

> When the audit misses a real bug, write the fixture for that bug
> *first*, then fix the audit. The fixture is the durable artefact;
> the fix is just code.

The Safari-leak fixture is planned as
`tests/fixtures/safari-leak/` and tracked in `ROADMAP.md`; it is not
yet committed. v0.3 will extend the same pattern to every other audit.

### Added

- `ROADMAP.md` documenting the gap between v0.1 and "trusted",
  with honest milestone descriptions.

## [0.1.0] - 2026-05-22

### Added

- Five regex-based audits: native permissions, third-party SDKs,
  outbound-link mode (Dart), network-isolation in declared
  protected paths, privacy-positive defaults.
- Dual-mode binary: stdio MCP server (default) + CLI subcommands.
- Per-language env-var allowlist overrides.
- Mirror of the UK ICO Age Appropriate Design Code's 15 standards
  under `aadc/`, with `fetch.sh` to refresh annually.
- Four templates: per-standard audit, conformance statement,
  privacy policy, incident response.
- Drop-in GitHub Actions workflow.

### Known limitations

See `ROADMAP.md` "Where we are" for the honest assessment.
