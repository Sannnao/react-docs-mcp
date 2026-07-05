#!/usr/bin/env node

/**
 * index.ts
 * react-hook-form-docs-mcp entry point: configures the shared engine for
 * react-hook-form/documentation and starts the MCP server.
 *
 * Bare --version / -v prints the package version and exits.
 * (No --docs-version flag: the source repo has no versioned docs snapshots.)
 */

import { configure } from '../../../src/config.js';
import { reactHookFormDocsPreset } from '../../../src/presets/reactHookFormDocs.js';
import { createServer } from '../../../src/server.js';

if (process.argv.includes('--version') || process.argv.includes('-v')) {
  console.log(reactHookFormDocsPreset.server.version);
  process.exit(0);
}

configure(reactHookFormDocsPreset);

createServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
