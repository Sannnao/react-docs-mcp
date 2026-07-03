/**
 * config.ts
 * Centralize configuration constants, driven by a swappable preset
 */

import { homedir } from 'os';
import { join } from 'path';

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
  // When true, prefer frontmatter `id` over the file path for building the doc URL slug
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
  docUrl: DocUrlConfig;
  sectionResourceOverrides?: Partial<Record<string, SectionResourceOverride>>;
}

/**
 * Resolved runtime config (preset values + derived repo.localPath)
 */
export interface DocsMcpConfig {
  repo: {
    url: string;
    localPath: string;
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
  docUrl: DocUrlConfig;
  sectionResourceOverrides?: Partial<Record<string, SectionResourceOverride>>;
}

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

const defaultPreset: DocsMcpPreset = {
  cacheDirName: 'react-docs-mcp',
  repoFolderName: 'react-dev-repo',
  repo: {
    url: 'https://github.com/reactjs/react.dev.git',
    contentPath: 'src/content',
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
    name: 'react-docs-mcp',
    version: '1.0.0',
  },
  sections: ['learn', 'reference', 'blog', 'community'],
  resourceUriScheme: 'react-docs',
  docsLabel: 'React',
  searchToolName: 'search_react_docs',
  searchToolDescription: 'Search across React documentation. Returns relevant documentation pages with snippets.',
  docUrl: { base: 'https://react.dev', useFrontmatterId: false },
};

// Module-level active config; swappable via configure() before the server starts.
let activeConfig: DocsMcpConfig = resolve(defaultPreset);

export function configure(preset: DocsMcpPreset): void {
  activeConfig = resolve(preset);
}

// Live binding: consumers importing the default export see updates made by configure().
export { activeConfig as default };
export type Section = string;
