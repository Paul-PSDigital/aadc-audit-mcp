# Roadmap

This document explains where `aadc-audit-mcp` is today, where it
isn't, and how it's going to get to "actually useful." Honesty about
the gap is intentional: a compliance tool that hides its blind spots
isn't a compliance tool.

## Where we are (v0.1)

Five regex-based audits over a small fixed set of file shapes:

| Audit | Threat model assumed | What it catches | What it misses |
|---|---|---|---|
| Native permission allowlist | Apps over-declare permissions, exposing children's location / contacts / camera / mic by default. | A dangerous permission newly added to `Info.plist` / `AndroidManifest.xml`. | Runtime-requested permissions on platforms that don't pre-declare them. Permissions requested transitively by third-party SDKs. |
| Third-party SDK allowlist | Analytics / ads / tracking SDKs ride in via dependency manifests. | An obviously-named ad/analytics package being added. | Bespoke in-house tracking. Privacy-shaped SDKs that take child data as a side effect. Anything imported via git URL or unscoped path. |
| Outbound-link mode | A child taps a link and lands in the parent's logged-in OS browser. | Dart `launchUrl()` calls outside declared parent-area paths. | React Native / iOS native / Android native equivalents (warn-only). Web `window.open` (warn-only). Links rendered via WebView itself. |
| Network isolation | Sensor-input code (mic / camera / on-device profiling) might quietly phone home. | Network-API imports in declared protected paths. | Network calls made via reflection / dynamic dispatch. Calls via subprocess. Anything that touches the network via a transitive dependency. |
| Privacy-positive defaults | A persisted default is "share" rather than "private." | Heuristic regex matches on suspicious keys. | Anything semantic. The vast majority of real default-setting decisions. |

**Honest assessment**: this is a useful entry point and a *bad* compliance
checker on its own. It will catch the most obvious explicit footguns
in a Flutter kids app. It will silently let through anything
the audit author didn't anticipate. The Safari-leak we documented in
`CHANGELOG.md` v0.1 → v0.2 is exactly this failure mode.

## The bar we're aiming at

A regulator, a domain expert, or an independent reviewer reading
`AUDIT.md` should be able to say "I trust this." That requires:

1. **Adversarial fixtures.** A `tests/fixtures/` tree of deliberately-
   bad kid-app projects. CI fails if any audit misses any fixture.
   Without this, every audit is a promise we can't keep.
2. **Threat-model documentation per check.** Every audit declares
   what threat it's looking for, what threats it deliberately doesn't
   cover, and when the threat model was last revisited. If the world
   shifts (we get a new safe-link pattern, a new platform vector),
   the docs make the obsolescence visible.
3. **Semantic checks via LLM tool calls.** Some standards are
   regex-impossible: Standard 13 (nudge techniques), Standard 4
   (reading-grade of privacy text), Standard 1 (best-interests UX
   judgement). For those the MCP needs to *use* an LLM through MCP
   itself, not pretend regex can substitute.
4. **Multi-stack support.** Today the audits assume Flutter + Node.
   Real support needed: React Native, Swift-only iOS, Kotlin-only
   Android, Unity / Unreal, .NET MAUI, plain web (React / Vue / Svelte).
5. **Each standard mapped to multiple complementary checks.**
   Standard 11 (parental controls) is not just `audit_launchurl`. It
   also needs: parent-gate existence, parent-gate difficulty, gate
   persistence behaviour, route-protection audit.
6. **Public CI + versioned releases + a security policy.** Anything
   we ask consumers to trust should itself be visibly maintained.

## Milestones

### v0.2: "honest" (next)

- ✅ Fix the inverted launchUrl threat model (done).
- ✅ Adversarial fixtures: at least one per audit, under
  `tests/fixtures/`, exercised by `npm test` (delivered in 0.3.1). 🚧 0.3.2
  adds a second, dependency-free harness (`tests/run.mjs`, Node built-ins only)
  that covers the three new presence/process audits (`dpia-present`,
  `age-assurance`, `data-rights-tools`) against their own fixtures, also run by
  `npm test`. Every audit still has at least one fixture, but coverage is now
  split across two harnesses (the `node:test` suite for the older audits, the
  self-test runner for the new three); unifying them is still open.
- 🚧 `THREAT-MODELS.md`: per-check threat-model documentation.
- ✅ `CHANGELOG.md` with the v0.1 to v0.2 Safari-leak story written
  up honestly. This is the credibility-building artefact.
- ✅ GitHub Actions: CI runs the build and the full fixture suite on
  every push and pull request (Node 18, 20, 22), delivered in 0.3.1.

### v0.3: "broader"

- 🚧 Multi-stack: plain web/JS is now covered (0.3.1 added web-aware
  `hardcoded-url`, `volume-cap`, and `launchurl` plus npm/Python SDK
  detection in `policy-mentions-sdks`, with web fixtures). React Native
  and Swift/Kotlin-native passes are still outstanding.
- 🚧 Standard 11 broken into 3-4 sub-audits (gate existence, difficulty,
  route protection, deep-link protection). (Not yet; `reading-grade`
  also touches Standard 11 but the parental-controls sub-audits are
  not built.)
- 🚧 Standard 4 reading-grade check. ✅ A `reading-grade` audit now
  ships and is exposed as `aadc.audit_reading_grade`, but it is a
  **heuristic**, not the LLM-driven check this milestone originally
  envisioned. The LLM-via-MCP version is still future work.
- ✅ Additional Standard 4 / 6 content checks now ship beyond
  reading-grade: `placeholders` (placeholder content not yet
  replaced), `hardcoded-url` (hardcoded URLs outside the CMS), and
  `link-reachability` (warn-only external link reachability).
- ✅ Further audits added and exposed as individual MCP tools and CLI
  subcommands: `volume-cap` (Standards 1, 14), `sentry-hygiene`
  (Standards 7, 9), and `policy-mentions-sdks` (warn-only, Standards
  4, 9). Note: as of 0.3.1 every audit (including these) has at least
  one paired fixture run in CI, closing the v0.2 fixture item above.
- 🚧 `aadc.write_audit` MCP tool: invoked by Claude after running every
  check, fills in the project's `docs/regulations/aadc/AUDIT.md`
  using `templates/AUDIT.md` as the skeleton. (Not built.)

### v0.4: "semantic"

- 🚧 Standards 2, 3, and 15 now have an initial automated check each as of
  0.3.2 (previously zero): `dpia-present`, `age-assurance`, and
  `data-rights-tools`. These are warn-only **presence/process heuristics**:
  they flag a missing DPIA document, a missing age-assurance signal, or a
  missing data-rights tool, but they cannot judge whether the DPIA is sound,
  whether age assurance is certain enough for the risks, or whether a tool
  works and is prominent. The substantive judgement for these standards is
  still the LLM-via-MCP work below.
- Standard 13 nudge-pattern detector (LLM-driven; scans for streaks,
  daily-quest pressure, infinite scroll, social proof patterns).
- Standard 12 profiling check (LLM reads the project's data-flow and
  flags any cross-session inference, even on-device).
- Standard 1 best-interests narrative check (LLM compares the
  conformance statement to the actual code surfaces).

### v1.0: "trusted"

- Every AADC standard has at least one machine check OR a clear
  reason why it's purely judgement-based.
- ≥ 90% audit-against-fixture coverage in CI.
- An external paediatric / privacy reviewer has signed a short
  "yes this is fit for purpose" attestation (the credibility-
  attestation we'd want a regulator to see).
- Listed at: <https://modelcontextprotocol.io/servers> (or the
  registry equivalent at the time).
- Published as `aadc-audit-mcp` on npm with semver discipline.

## What this is NOT

- A replacement for paid third-party compliance audits when a
  regulator query lands. Use it as preparation, not as defence.
- A complete safeguarding tool. The Online Safety Act, MHRA medical
  device regulations, COPPA, and platform-specific kids-policy
  reviews all sit alongside.
- An attestation. We document our blind spots; we don't certify
  conformance.

## Maintenance principle

> When the audit misses a real bug, write the fixture for that bug
> *first*, then fix the audit. The fixture is the durable artefact;
> the fix is just code.

If we ever skip the fixture step, the next regression will look
exactly like the Safari-leak miss.
