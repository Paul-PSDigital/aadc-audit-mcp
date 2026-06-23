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
  /** Stable identifier, used by MCP tool names + CLI subcommands. */
  id: string;
  /** Human-readable label e.g. "Native permission allowlist". */
  title: string;
  /** AADC standards this audit primarily covers. */
  standards: number[];
  severity: Severity;
  findings: AuditFinding[];
  /** One-line summary at the bottom of the audit output. */
  summary: string;
  /**
   * false => the audit had ZERO relevant inputs to inspect (e.g. a
   * Dart/web audit run against a project with no such files, or a
   * config-gated audit that was not enabled). Omitted defaults to
   * applicable:true. INVARIANT: applicable:false MUST pair with
   * severity:'pass' so a not-applicable audit can never affect the
   * process exit code or the MCP isError flag. Rendered as N/A, not
   * PASS, and counted separately in the report tally.
   */
  applicable?: boolean;
  /**
   * Count of files/inputs the audit actually examined, for
   * transparency in the report. 0 on the applicable:false path;
   * undefined is acceptable for audits not yet instrumented.
   */
  scanned?: number;
}

export interface AuditOptions {
  /** Absolute path to the target project root. */
  projectRoot: string;
  /** Per-audit allowlist overrides; see each audit for supported keys. */
  allowlists?: Record<string, string[]>;
  /** Per-audit string overrides (paths, regexes etc). */
  options?: Record<string, string>;
}
