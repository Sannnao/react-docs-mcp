/**
 * reactNativeDocs.ts
 * Preset for react-native-docs-mcp: github.com/facebook/react-native-website.git
 *
 * Structure verified directly against the repo (Docusaurus-based):
 * - Docs live at root `docs/` (not under `website/`), 230 .md + 9 .mdx files.
 * - 213 of 241 files sit flat at `docs/` root with no section; only
 *   `the-new-architecture/`, `legacy/`, and `releases/` are real subfolders
 *   (older versioned snapshots may lack some — the server filters advertised
 *   sections to those that exist on disk at runtime).
 * - "latest" targets the unversioned root `docs/` folder; pinned versions
 *   target `website/versioned_docs/version-X.YY/` inside the same clone.
 * - Docusaurus routes by frontmatter `id` when present (in all versions), so
 *   the engine resolves ids into canonical doc paths/slugs at index time
 *   (docUrl.useFrontmatterId).
 * - website/blog/ is a separate content root and is out of scope for v1.
 */

import type { DocsMcpPreset } from '../config.js';
import { DEFAULT_SEARCH } from './searchDefaults.js';

export const LATEST_VERSION = 'latest';

export function resolveReactNativeDocsPreset(version: string = LATEST_VERSION): DocsMcpPreset {
  const isLatest = version === LATEST_VERSION;

  if (!isLatest && !/^\d+\.\d+$/.test(version)) {
    throw new Error(
      `Invalid React Native docs version "${version}". Expected a release like "0.77" or "${LATEST_VERSION}".`
    );
  }

  return {
    cacheDirName: 'react-native-docs-mcp',
    repoFolderName: 'react-native-website-repo',
    repo: {
      url: 'https://github.com/facebook/react-native-website.git',
      contentPath: isLatest ? 'docs' : `website/versioned_docs/version-${version}`,
    },
    search: { ...DEFAULT_SEARCH },
    server: {
      name: 'react-native-docs-mcp',
      version: '0.2.0',
    },
    sections: ['the-new-architecture', 'legacy', 'releases'],
    resourceUriScheme: 'react-native-docs',
    docsLabel: 'React Native',
    searchToolName: 'search_react_native_docs',
    searchToolDescription: 'Search across React Native documentation. Returns relevant documentation pages with snippets.',
    pathExample: 'the-new-architecture/using-codegen',
    docUrl: {
      base: isLatest ? 'https://reactnative.dev/docs' : `https://reactnative.dev/docs/${version}`,
      // Frontmatter-id routing is a property of the Docusaurus content format,
      // not of the version — versioned snapshots carry the same id overrides
      useFrontmatterId: true,
    },
  };
}
