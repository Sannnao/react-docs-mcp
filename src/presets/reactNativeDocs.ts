/**
 * reactNativeDocs.ts
 * Preset for react-native-docs-mcp: github.com/facebook/react-native-website.git
 *
 * Structure verified directly against the repo (Docusaurus-based):
 * - Docs live at root `docs/` (not under `website/`), 230 .md + 9 .mdx files.
 * - 213 of 241 files sit flat at `docs/` root with no section; only
 *   `the-new-architecture/`, `legacy/`, and `releases/` are real subfolders.
 * - `docs/` targets the unversioned "current" folder rather than a pinned
 *   `versioned_docs/version-X.XX`, since a pinned version string would go
 *   stale every release; content may be briefly ahead of the latest release.
 * - Some pages set a frontmatter `id` that overrides the file-path-derived
 *   URL slug (e.g. docs/getting-started.md -> id: environment-setup), so
 *   doc URLs must prefer `id` over the raw path to avoid dead links.
 * - website/blog/ is a separate content root and is out of scope for v1.
 */

import type { DocsMcpPreset } from '../config.js';

export const reactNativeDocsPreset: DocsMcpPreset = {
  cacheDirName: 'react-native-docs-mcp',
  repoFolderName: 'react-native-website-repo',
  repo: {
    url: 'https://github.com/facebook/react-native-website.git',
    contentPath: 'docs',
  },
  search: {
    defaultLimit: 10,
    maxLimit: 50,
    minScore: 0.1,
    semanticSearchEnabled: true,
    semanticMinSimilarity: 0.3,
    hybridKeywordWeight: 0.3,
    hybridSemanticWeight: 0.7,
  },
  server: {
    name: 'react-native-docs-mcp',
    version: '0.1.0',
  },
  sections: ['the-new-architecture', 'legacy', 'releases'],
  resourceUriScheme: 'react-native-docs',
  docsLabel: 'React Native',
  searchToolName: 'search_react_native_docs',
  searchToolDescription: 'Search across React Native documentation. Returns relevant documentation pages with snippets.',
  docUrl: { base: 'https://reactnative.dev/docs', useFrontmatterId: true },
};
