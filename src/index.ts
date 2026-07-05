#!/usr/bin/env node

/**
 * index.ts
 * react-docs-mcp entry point: configures the shared engine for react.dev
 * and starts the MCP server.
 */

import { configure } from './config.js';
import { reactDocsPreset } from './presets/reactDocs.js';
import { createServer } from './server.js';

// package.json's postinstall runs `node dist/index.js --version`; without this
// guard that would start the server and clone the docs repo during npm install.
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  console.log(reactDocsPreset.server.version);
  process.exit(0);
}

configure(reactDocsPreset);

createServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
