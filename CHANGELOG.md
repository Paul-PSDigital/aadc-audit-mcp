# Changelog

All notable changes to `aadc-audit-mcp`, in reverse-chronological
order. Where a release fixes a bug we shipped, the entry explains how
the bug got there in the first place. The maintenance principle of
this project is "be honest about what the audit missed and why."

The format follows [Keep a Changelog](https://keepachangelog.com/),
the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

## [0.2.0] — 2026-05-22

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
WebView for kid-facing links — flipping the threat model so that
`LaunchMode.externalApplication` itself became the unsafe option in
kid-facing surfaces — the audit didn't flip with it.

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

## [0.1.0] — 2026-05-22

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
