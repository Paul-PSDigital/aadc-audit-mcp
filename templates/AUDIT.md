---
title: "{{PROJECT_NAME}}: UK ICO Age Appropriate Design Code — audit"
subtitle: "Per-standard evidence + automated check status"
author: "{{PROJECT_OWNER}}"
date: "{{TODAY}}"
---

# AADC audit ({{PROJECT_NAME}})

**Last reviewed: {{TODAY}} by {{REVIEWER_NAME}}.**
**Next scheduled review: {{TODAY+1YEAR}}.**

This is the working artefact: one row per AADC standard, with the
evidence in our codebase, and where automated CI guards exist that
prevent regression. Re-run as part of every store submission and at
least once a year.

Format key:

- **Standard**: number + ICO title.
- **Requirement summary**: one paragraph in your own words. Full ICO
  text in `docs/regulations/aadc/<n>-<slug>.md`.
- **{{PROJECT_NAME}} evidence**: file paths or commit-able artefacts
  proving you meet the standard.
- **Automated**: which CI workflow + step catches a regression.
  ❌ = no automation, relies on human review.
- **Status**: ✅ / 🚧 / ❌ for "meets / partial / does not meet".

---

## 1. Best interests of the child

**Requirement**: Consider what is in the best interests of the child
when designing and developing online services likely to be accessed
by them. Commercial interests don't override the child's best
interests.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}
- {{evidence path}}

**Automated**: ❌ (judgement-based standard)

**Status**: {{✅ / 🚧 / ❌}}

---

## 2. Data protection impact assessments

**Requirement**: Undertake a DPIA before processing any personal data
in services likely to be accessed by children.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: ❌ (document chore)

**Status**: {{✅ / 🚧 / ❌}}

---

## 3. Age-appropriate application

**Requirement**: Apply the standards to all users unless you can
robustly establish their age.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: ❌ (structural)

**Status**: {{✅ / 🚧 / ❌}}

---

## 4. Transparency

**Requirement**: Privacy info, terms, policies must be concise,
prominent, clear, suited to the child's age, and presented at the
point they need it.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: 🚧 (partial; covered by string-key drift check if you
have one)

**Status**: {{✅ / 🚧 / ❌}}

---

## 5. Detrimental use of data

**Requirement**: Do not use children's personal data in any way that
has been shown to be detrimental to their wellbeing.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: ✅ via `audit-sdks.sh` (blocks ad / analytics SDKs).

**Status**: {{✅ / 🚧 / ❌}}

---

## 6. Policies and community standards

**Requirement**: Uphold your own published terms, policies, and
community standards.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: {{✅ if you have a content-moderation pipeline / ❌}}

**Status**: {{✅ / 🚧 / ❌}}

---

## 7. Default settings

**Requirement**: Settings must be 'high privacy' by default.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: ✅ via `audit-defaults.sh` (warn-only report on
suspicious defaults).

**Status**: {{✅ / 🚧 / ❌}}

---

## 8. Data minimisation

**Requirement**: Collect and retain only the minimum amount of
personal data needed.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: ✅ via `audit-permissions.sh` + `audit-network-isolation.sh`.

**Status**: {{✅ / 🚧 / ❌}}

---

## 9. Data sharing

**Requirement**: Do not disclose children's data unless you can show
a compelling reason.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: ✅ via `audit-sdks.sh`.

**Status**: {{✅ / 🚧 / ❌}}

---

## 10. Geolocation

**Requirement**: Switch geolocation options off by default.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: ✅ via `audit-permissions.sh` (blocks location
permissions unless explicitly allowlisted).

**Status**: {{✅ / 🚧 / ❌}}

---

## 11. Parental controls

**Requirement**: If you provide parental controls, tell the child in
an age-appropriate way.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: ✅ via `audit-launchurl.sh`.

**Status**: {{✅ / 🚧 / ❌}}

---

## 12. Profiling

**Requirement**: Switch options that use profiling off by default.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: ❌ (caught indirectly by SDK allowlist; document
the on-device-only justification in the conformance statement).

**Status**: {{✅ / 🚧 / ❌}}

---

## 13. Nudge techniques

**Requirement**: Do not use nudge techniques to lead or encourage
children to weaken their privacy or extend their use of your service.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: 🚧 (partial; SDK allowlist catches engagement
SDKs but UX patterns need human review).

**Status**: {{✅ / 🚧 / ❌}}

---

## 14. Connected toys and devices

**Requirement**: If you provide a connected toy or device, ensure
you include effective tools to enable conformance with this code.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: ✅ via `audit-network-isolation.sh` for any
device-pairing code paths.

**Status**: {{✅ / 🚧 / ❌}}

---

## 15. Online tools

**Requirement**: Provide prominent and accessible tools to help
children exercise their data protection rights.

**{{PROJECT_NAME}} evidence**:
- {{evidence path}}

**Automated**: ❌ (widget tests are the canonical proof; add
one for the data-deletion + report-a-bug + privacy-policy tiles).

**Status**: {{✅ / 🚧 / ❌}}

---

# Summary

| # | Standard | Status | Automated |
|---|---|---|---|
| 1 | Best interests | {{}} | ❌ |
| 2 | DPIAs | {{}} | ❌ |
| 3 | Age-appropriate application | {{}} | ❌ |
| 4 | Transparency | {{}} | 🚧 |
| 5 | Detrimental use of data | {{}} | ✅ |
| 6 | Policies + community standards | {{}} | {{}} |
| 7 | Default settings | {{}} | ✅ |
| 8 | Data minimisation | {{}} | ✅ |
| 9 | Data sharing | {{}} | ✅ |
| 10 | Geolocation | {{}} | ✅ |
| 11 | Parental controls | {{}} | ✅ |
| 12 | Profiling | {{}} | ❌ |
| 13 | Nudge techniques | {{}} | 🚧 |
| 14 | Connected toys + devices | {{}} | ✅ |
| 15 | Online tools | {{}} | ❌ |
