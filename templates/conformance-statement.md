---
title: "{{PROJECT_NAME}}: UK Children's Code conformance"
subtitle: "Standard-by-standard narrative for the judgement-based standards"
author: "{{PROJECT_OWNER}}"
date: "{{TODAY}}"
---

# Children's Code conformance statement

**Effective date:** {{TODAY}}
**Last reviewed:** {{TODAY}}
**Maintainer:** {{MAINTAINER_NAME}} ({{MAINTAINER_EMAIL}})

This document is the narrative companion to `docs/regulations/aadc/AUDIT.md`.
The AUDIT is auto-generated and machine-checked; THIS document is the
human-written "show your working" that a regulator would actually read
if anything ever escalated.

## Summary

{{One paragraph: who you are, what your service does, who its
intended audience is, why the AADC applies, and your overall
compliance posture.}}

## Standard-by-standard narrative

### 1. Best interests of the child

{{Explain why the product itself prioritises children's welfare:
not the data-processing decisions but the SCOPE decisions. What
isn't being built that could have been, because it would have
been bad for children.}}

### 2. Data protection impact assessments

{{Where the DPIA lives. Who updates it. Frequency. Most recent
date.}}

### 3. Age-appropriate application

{{Whether you target one age group or several. If several, how
the experience differs. If just one, why a uniform experience is
appropriate.}}

### 4. Transparency

{{Where the privacy policy lives. Reading level. In-app surfaces
where rights / choices are explained. Plain-English summary
location.}}

### 5. Detrimental use of data

{{Affirmative list of every third party that touches user data,
plus an enumerative list of what your service does NOT do (no
ads, no profiling, no detrimental commercial use, etc).}}

### 6. Policies and community standards

{{Editorial standards. Who can publish. Any content guard /
moderation pipeline. How you respond when something slips
through.}}

### 7. Default settings

{{Enumerate every default that affects privacy posture. State
why each one is the most-protective option a reasonable child
would expect.}}

### 8. Data minimisation

{{Enumerate every piece of personal data your service holds and
why each one is necessary. Cross-reference to your privacy policy.}}

### 9. Data sharing

{{Confirm no data sharing except documented third parties (e.g.
Sentry for crash reporting). Provide each third party's privacy
policy URL.}}

### 10. Geolocation

{{Confirm OFF by default. Confirm no platform-permission entry
declares location. If location IS used (e.g. for an educational or
accessibility reason), explain the on-screen indicator.}}

### 11. Parental controls

{{Explain what is parent-gated and what isn't. The parent gate
mechanism itself (challenge type). Whether you "monitor" the
child in any way and how you tell them.}}

### 12. Profiling

{{Whether any profiling exists at all. If yes, on-device only
or server-side? What it's used for? Why it isn't detrimental?
Cross-reference DPIA.}}

### 13. Nudge techniques

{{Affirmative list of every "nudge" UX pattern in your app
(typically just the OS-provided review prompt). For each, what
triggers it, what protects children from it, and why it isn't a
data-minimisation or wellbeing concern.}}

### 14. Connected toys and devices

{{If you connect to any external device, describe what data flows
across the connection and how the child is protected during that
flow.}}

### 15. Online tools

{{The in-app surfaces children / parents use to exercise their
rights. "Delete my data", "Report a bug", privacy policy access,
reset options. Reachability claims (≤N taps).}}

## Annual review

This statement is re-read every year. Sign + date below to confirm
review.

- {{TODAY}}: Initial statement issued ({{REVIEWER_NAME}}).
