// MCP server: exposes the AADC audit operations as tools any
// MCP-compatible client (Claude Code, Claude Desktop, Cursor, etc) can
// invoke. Communicates over stdio so the user's source code never
// leaves their machine.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { AUDITS, runAll } from './audits/index.js';
import type { AuditOptions, AuditResult } from './audits/index.js';
import { readStandardFullText, readStandardSummaries } from './standards.js';

// JSON Schema fragment used by every audit tool. Optional per-audit
// allowlist overrides keep the schema small while still letting a
// caller tune to their project.
const AUDIT_TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    projectRoot: {
      type: 'string',
      description:
        'Absolute path to the target project root. Defaults to the current working directory.',
    },
    allowlists: {
      type: 'object',
      description:
        'Per-language allowlist overrides (e.g. ios, android, flutter, npm, python, protectedPaths). Each value is an array of strings.',
      additionalProperties: { type: 'array', items: { type: 'string' } },
    },
  },
};

// Human-readable description per audit id (the kebab-case keys of
// AUDITS). Each ends by naming the AADC standards it covers. The
// ListTools handler generates one tool per id from this map, so adding
// a new audit to AUDITS (with an entry here) surfaces it automatically.
const AUDIT_DESCRIPTIONS: Record<string, string> = {
  permissions:
    'Audit native iOS Info.plist and Android AndroidManifest.xml for any permission outside the AADC-safe allowlist. Standards 8, 10.',
  sdks: 'Audit dependency manifests (pubspec.yaml, package.json, requirements.txt) for analytics / advertising / tracking SDKs or any dependency outside the allowlist. Standards 5, 9, 12, 13.',
  launchurl:
    'Audit Dart launchUrl() calls and web source (.js/.ts/.html etc) so kid-facing files use the safe-link helper and only declared parent-area paths may open the external browser. Standards 11, 14.',
  'network-isolation':
    'Audit declared protected paths (microphone, camera, on-device-only data) for any network API import. Standard 8.',
  defaults:
    'Heuristic warn-only scan for default-true on suspicious privacy keys (share / track / profile / etc). Standard 7.',
  'reading-grade':
    'Audit user-facing copy for reading grade above the age-appropriate threshold. Standards 4, 11.',
  placeholders:
    'Scan for unreplaced placeholder content (lorem ipsum, TODO copy, dummy text) in shipped user-facing strings. Standards 4, 6.',
  'link-reachability':
    'Warn-only check that external links referenced in content are reachable and not dead. Standards 4, 6.',
  'volume-cap':
    'Verify every audio/video player (Dart and web source: .js/.ts/.html etc) declares an explicit volume cap. Standards 1, 14.',
  'sentry-hygiene':
    'Audit Sentry error-reporting initialisation for child-data hygiene (PII scrubbing, no session replay). Standards 7, 9.',
  'hardcoded-url':
    'Flag hardcoded URLs outside the CMS that bypass content review, in Dart and web source (.js/.ts/.html etc). Standards 4, 6.',
  'policy-mentions-sdks':
    'Warn-only check that the privacy policy names every external-service SDK the app depends on. Standards 4, 9.',
};

// Map an audit id (kebab-case) to its MCP tool name, and back. The
// existing convention is aadc.audit_<id with hyphens as underscores>,
// e.g. id 'network-isolation' -> 'aadc.audit_network_isolation'.
const TOOL_PREFIX = 'aadc.audit_';
function toolNameForId(id: string): string {
  return `${TOOL_PREFIX}${id.replace(/-/g, '_')}`;
}
function idForToolName(name: string): string {
  return name.slice(TOOL_PREFIX.length).replace(/_/g, '-');
}

function asOptions(args: Record<string, unknown> | undefined): AuditOptions {
  const projectRoot =
    (typeof args?.projectRoot === 'string' && args.projectRoot) || process.cwd();
  const allowlists =
    typeof args?.allowlists === 'object' && args?.allowlists
      ? (args.allowlists as AuditOptions['allowlists'])
      : undefined;
  return { projectRoot, allowlists };
}

export function renderResult(r: AuditResult): string {
  // A not-applicable audit (applicable:false) gets a distinct N/A token so
  // it never reads as a green [PASS]. Scanned count is appended for
  // transparency when present.
  const naFlag = r.applicable === false;
  const standardsLabel = `AADC Standard${r.standards.length > 1 ? 's' : ''} ${r.standards.join(', ')}`;
  const scannedSuffix = typeof r.scanned === 'number' ? ` (scanned ${r.scanned})` : '';
  const head = naFlag
    ? `[- N/A] ${r.title} (${standardsLabel})${scannedSuffix}`
    : `[${r.severity.toUpperCase()}] ${r.title} (${standardsLabel})${scannedSuffix}`;
  if (r.findings.length === 0) return `${head}\n${r.summary}`;
  const body = r.findings.map((f) => `  - ${f.where}: ${f.message}`).join('\n');
  return `${head}\n${body}\n\n${r.summary}`;
}

function asTextContent(text: string) {
  return [{ type: 'text' as const, text }];
}

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: 'aadc-audit', version: '0.3.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'aadc.audit_all',
        description:
          'Run every AADC compliance audit against a local project and return the consolidated result. Use this whenever the user asks for a full AADC review of a kids app, or before a store submission.',
        inputSchema: AUDIT_TOOL_SCHEMA,
      },
      // One tool per audit in the registry, generated from the
      // descriptions map and the naming rule so new audits surface
      // automatically.
      ...Object.keys(AUDITS).map((id) => ({
        name: toolNameForId(id),
        description: AUDIT_DESCRIPTIONS[id] ?? `Run the ${id} AADC audit.`,
        inputSchema: AUDIT_TOOL_SCHEMA,
      })),
      {
        name: 'aadc.list_standards',
        description:
          'Return the 15 AADC standards with their one-line statutory summaries. Use this as a reference when filling in a conformance statement.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'aadc.read_standard',
        description:
          'Return the full ICO-published text of one AADC standard by number (1-15). Use this when you need the verbatim wording for a conformance statement or DPIA.',
        inputSchema: {
          type: 'object',
          properties: {
            number: { type: 'integer', minimum: 1, maximum: 15 },
          },
          required: ['number'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    if (name === 'aadc.audit_all') {
      const results = await runAll(asOptions(args));
      return {
        content: asTextContent(results.map(renderResult).join('\n\n---\n\n')),
        isError: results.some((r) => r.severity === 'fail' && r.applicable !== false),
      };
    }

    if (name.startsWith(TOOL_PREFIX)) {
      const id = idForToolName(name);
      const fn = AUDITS[id];
      if (fn) {
        const result = await fn(asOptions(args));
        return {
          content: asTextContent(renderResult(result)),
          isError: result.severity === 'fail' && result.applicable !== false,
        };
      }
    }

    if (name === 'aadc.list_standards') {
      const summaries = await readStandardSummaries();
      const text = summaries
        .map((s) => `${s.number}. ${s.title}\n   ${s.summary}`)
        .join('\n\n');
      return { content: asTextContent(text), isError: false };
    }

    if (name === 'aadc.read_standard') {
      const n = (args as { number?: number })?.number ?? 0;
      const text = await readStandardFullText(n);
      return { content: asTextContent(text), isError: false };
    }

    return {
      content: asTextContent(`Unknown tool: ${name}`),
      isError: true,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
