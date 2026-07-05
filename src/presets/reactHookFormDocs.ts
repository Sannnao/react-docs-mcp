/**
 * reactHookFormDocs.ts
 * Preset for react-hook-form-docs-mcp: github.com/react-hook-form/documentation.git
 *
 * Structure verified directly against the repo (contentlayer/Next.js-based):
 * - Content at `src/content`: 38 .mdx files, no .md, no `_`-prefixed partials.
 * - One real section subfolder: `docs/` (API reference); 5 root-level pages
 *   (get-started, advanced-usage, faqs, ts, migrate-v7-to-v8).
 * - No frontmatter `id` slug overrides — URLs map straight from file paths
 *   (verified live: docs/useform, get-started, docs/useform/register all 200).
 * - No versioned docs folders — no --docs-version flag needed.
 */

import type { DocsMcpPreset } from '../config.js';
import { DEFAULT_SEARCH } from './searchDefaults.js';

export const reactHookFormDocsPreset: DocsMcpPreset = {
  cacheDirName: 'react-hook-form-docs-mcp',
  repoFolderName: 'react-hook-form-documentation-repo',
  repo: {
    url: 'https://github.com/react-hook-form/documentation.git',
    contentPath: 'src/content',
  },
  search: { ...DEFAULT_SEARCH },
  server: {
    name: 'react-hook-form-docs-mcp',
    version: '0.1.0',
  },
  sections: ['docs'],
  resourceUriScheme: 'react-hook-form-docs',
  docsLabel: 'React Hook Form',
  searchToolName: 'search_react_hook_form_docs',
  searchToolDescription: 'Search across React Hook Form documentation. Returns relevant documentation pages with snippets.',
  pathExample: 'docs/useform',
  docUrl: { base: 'https://react-hook-form.com', useFrontmatterId: false },
};
