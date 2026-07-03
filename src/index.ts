#!/usr/bin/env node

/**
 * index.ts
 * react-docs-mcp entry point: configures the shared engine for react.dev
 * and starts the MCP server.
 */

import { configure } from './config.js';
import { reactDocsPreset } from './presets/reactDocs.js';
import { createServer } from './server.js';

configure(reactDocsPreset);

createServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
