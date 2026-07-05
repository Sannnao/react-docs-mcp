/**
 * config.ts
 * Centralize configuration constants, driven by a swappable preset
 */

import { homedir } from 'os';
import { join } from 'path';
import { reactDocsPreset } from './presets/reactDocs.js';

// Determine cache directory based on OS
const getCacheDir = (cacheDirName: string): string => {
  const platform = process.platform;
  const home = homedir();

  if (platform === 'darwin' || platform === 'linux') {
    // macOS and Linux: use ~/.cache
    return join(home, '.cache', cacheDirName);
  } else if (platform === 'win32') {
    // Windows: use %LOCALAPPDATA%
    return join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), cacheDirName);
  }

  // Fallback for other platforms
  return join(home, `.${cacheDirName}`);
};

export interface SearchConfig {
  defaultLimit: number;
  maxLimit: number;
  minScore: number;
  semanticSearchEnabled: boolean;
  semanticMinSimilarity: number; // Minimum cosine similarity for semantic results
  hybridKeywordWeight: number;   // Weight for keyword search in hybrid mode
  hybridSemanticWeight: number;  // Weight for semantic search in hybrid mode
}

export interface DocUrlConfig {
  base: string;
  // When true, a doc's frontmatter `id` overrides the file-path-derived slug
  // (Docusaurus routing); the slug is resolved into doc.path at index time
  useFrontmatterId: boolean;
}

export interface SectionResourceOverride {
  name: string;
  description: string;
}

/**
 * Static values that fully describe a docs source (react.dev, react-native-website, etc.)
 */
export interface DocsMcpPreset {
  cacheDirName: string;   // OS cache folder name
  repoFolderName: string; // subfolder under the cache dir the repo is cloned into
  repo: {
    url: string;
    contentPath: string;
  };
  search: SearchConfig;
  server: {
    name: string;
    version: string;
  };
  sections: readonly string[];
  resourceUriScheme: string;
  docsLabel: string;
  searchToolName: string;
  searchToolDescription: string;
  pathExample: string; // a real doc path used in tool schema examples
  docUrl: DocUrlConfig;
  sectionResourceOverrides?: Partial<Record<string, SectionResourceOverride>>;
}

/**
 * Resolved runtime config: preset values with repo.localPath derived from the
 * cache dir. Derived from DocsMcpPreset so new preset fields flow through.
 */
export type DocsMcpConfig = Omit<DocsMcpPreset, 'cacheDirName' | 'repoFolderName' | 'repo'> & {
  repo: {
    url: string;
    contentPath: string;
    localPath: string;
  };
};

function resolve(preset: DocsMcpPreset): DocsMcpConfig {
  const { cacheDirName, repoFolderName, repo, ...rest } = preset;

  return {
    ...rest,
    repo: {
      url: repo.url,
      contentPath: repo.contentPath,
      localPath: join(getCacheDir(cacheDirName), repoFolderName),
    },
  };
}

// Module-level active config; swappable via configure() before the server starts.
// Seeded from the react.dev preset (single source of truth — no duplicate defaults).
let activeConfig: DocsMcpConfig = resolve(reactDocsPreset);

export function configure(preset: DocsMcpPreset): void {
  activeConfig = resolve(preset);
}

// Live binding: consumers importing the default export see updates made by configure().
export { activeConfig as default };
