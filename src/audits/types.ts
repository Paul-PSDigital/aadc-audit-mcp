// Common types shared by every audit module.
//
// Each audit returns the same structured shape so the MCP server, the
// CLI, and any future CI integration can render it uniformly.

export type Severity = 'pass' | 'warn' | 'fail';

export interface AuditFinding {
  /** A short, file-line-citable label e.g. "Info.plist:69". */
  where: string;
  /** What is wrong. */
  message: string;
  /** Which AADC standard(s) this finding maps to. */
  standards: number[];
}

export interface AuditResult {
  /** Stable identifier — used by MCP tool names + CLI subcommands. */
  id: string;
  /** Human-readable label e.g. "Native permission allowlist". */
  title: string;
  /** AADC standards this audit primarily covers. */
  standards: number[];
  severity: Severity;
  findings: AuditFinding[];
  /** One-line summary at the bottom of the audit output. */
  summary: string;
}

export interface AuditOptions {
  /** Absolute path to the target project root. */
  projectRoot: string;
  /** Per-audit allowlist overrides; see each audit for supported keys. */
  allowlists?: Record<string, string[]>;
  /** Per-audit string overrides (paths, regexes etc). */
  options?: Record<string, string>;
}
