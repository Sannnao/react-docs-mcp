#!/usr/bin/env node

/**
 * index.ts
 * react-native-docs-mcp entry point: configures the shared engine for
 * facebook/react-native-website and starts the MCP server.
 */

import { configure } from '../../../src/config.js';
import { reactNativeDocsPreset } from '../../../src/presets/reactNativeDocs.js';
import { createServer } from '../../../src/server.js';

configure(reactNativeDocsPreset);

createServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
