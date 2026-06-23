---
title: "{{PROJECT_NAME}}: Incident Response Runbook"
subtitle: "What to do when something goes wrong"
---

# Incident Response

This is the one-page playbook for the moments where {{PROJECT_NAME}}
has gone wrong in a way that matters. It is written so the
maintainer can act without thinking from a cold start at 2am: each
scenario lists the **detection signal**, **immediate action**,
**rollback path**, **comms**, and **post-incident log entry**.

Print this page out. Keep it next to the laptop you ship from.

## General principles

1. **Stop the bleed first.** Roll back, kill-switch, or unpublish.
   Diagnose afterwards.
2. **Children's safety overrides every other concern**, including not
   wanting to scare users. If you suspect a hazard, kill the feature.
3. **Log everything** as you go. Screenshots, version numbers,
   time stamps.
4. **Tell {{KEY_STAKEHOLDER}}** before posting anything externally.
5. **File the hazard / risk log entry** at the end (e.g. ISO 14971
   if you ship a regulated product, or your own risk register).

---

## Scenario A: Editorial / CMS account compromise

**Detection signal**:
- Unexpected publish alert in {{ALERT_CHANNEL}}.
- Editor reports a phishing email they may have clicked.
- The content guard logs a URL allowlist violation.

**Immediate action**:
1. Revoke editor's session in CMS; disable account.
2. Confirm no poisoned content reached the wild (check alert log).
3. If poison did reach: trigger kill-switch / forced update.
4. Tighten URL / content guard if you can identify the vector.

**Rollback path**:
- {{Specific rollback mechanism for your project}}

**Comms**:
- {{Key stakeholder}}: phone call within 30 minutes.
- ICO: notify within 72 hours if personal data was exposed.

**Post-incident log entry**:
- {{Your hazard log location}}, entry "Editor account compromise".

---

## Scenario B: Parent reports inappropriate content

**Detection signal**: User report (form / email / app store).

**Immediate action**:
1. Read the report fully before touching anything.
2. Locate the offending content. Unpublish.
3. Confirm a fresh manifest / build / cache has dropped it.

**Rollback path**: Unpublish is the rollback.

**Comms**: Acknowledge the reporter within 24 hours.

---

## Scenario C: Child reports physical harm from the app

**Detection signal**: Any safety-shaped report (ear pain, eye
strain, seizure, etc).

**Immediate action** (highest priority of any scenario):
1. {{Flag off every implicated feature in production}}.
2. {{Phone your safety / incident lead}}.
3. Wait for sign-off from your safety lead before re-enabling
   anything.

**Rollback path**: Feature-flag flip.

**Comms**:
- Reporting family: phone call from your incident lead same day.
- {{Regulator if applicable}} if a regulated product is implicated
  (e.g. MHRA / CQC for a medical device).

---

## Scenario D: {{Project-specific failure scenario}}

{{Detection + actions + rollback + comms}}

---

## Scenario E: {{Project-specific failure scenario}}

{{Detection + actions + rollback + comms}}

---

## Comms templates

### To a reporting parent (within 24 hours)

> Thank you for telling us. We have read your report and have
> already turned off the [feature name]. {{Your safety lead}} will be
> in touch [today / by <date>]. If your child is in any discomfort,
> please seek appropriate medical advice; this app is a support tool,
> not a substitute for professional care.
>
> -- {{PROJECT_NAME}} team

## After-action review

Within 7 days of any incident, schedule a 30-minute review.
Three questions:

1. What surprised us?
2. What single change would have prevented this entirely?
3. What is the cheapest version of that change?

Decision lands in {{operations doc}} or as a new backlog task.
