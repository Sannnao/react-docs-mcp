#!/usr/bin/env node

/**
 * index.ts
 * react-native-docs-mcp entry point: configures the shared engine for
 * facebook/react-native-website and starts the MCP server.
 *
 * Docs version defaults to "latest" (the always-current docs/ folder).
 * Override with --docs-version=0.75 as a CLI arg, or the
 * REACT_NATIVE_DOCS_VERSION env var (CLI arg takes priority), e.g.:
 *   npx react-native-docs-mcp --docs-version=0.75
 *   claude mcp add --transport stdio react-native-docs -- npx react-native-docs-mcp --docs-version=0.75
 *
 * Bare --version / -v prints the package version and exits.
 */

import { configure } from '../../../src/config.js';
import { resolveReactNativeDocsPreset, LATEST_VERSION } from '../../../src/presets/reactNativeDocs.js';
import { createServer } from '../../../src/server.js';

const argv = process.argv.slice(2);

if (argv.includes('--version') || argv.includes('-v')) {
  console.log(resolveReactNativeDocsPreset().server.version);
  process.exit(0);
}

function parseDocsVersionArg(args: string[]): string | undefined {
  for (const arg of args) {
    const match = arg.match(/^--docs-version=(.+)$/);
    if (match) return match[1];
  }

  const flagIndex = args.indexOf('--docs-version');
  const value = flagIndex !== -1 ? args[flagIndex + 1] : undefined;
  if (value && !value.startsWith('-')) {
    return value;
  }

  return undefined;
}

const docsVersion = parseDocsVersionArg(argv) ?? process.env.REACT_NATIVE_DOCS_VERSION ?? LATEST_VERSION;

if (docsVersion !== LATEST_VERSION) {
  console.error(`Using React Native docs version: ${docsVersion} (best-effort; only "latest" is fully verified)`);
}

try {
  configure(resolveReactNativeDocsPreset(docsVersion));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

createServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
