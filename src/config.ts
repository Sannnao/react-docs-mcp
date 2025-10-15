/**
 * config.ts
 * Centralize configuration constants
 */

const CONFIG = {
  // Repository settings
  repo: {
    url: 'https://github.com/reactjs/react.dev.git',
    localPath: './data/react-dev-repo',
    contentPath: 'src/content',
  },

  // Search settings
  search: {
    defaultLimit: 10,
    maxLimit: 50,
    minScore: 0.1,
    semanticSearchEnabled: true,
    semanticMinSimilarity: 0.3,  // Minimum cosine similarity for semantic results
    hybridKeywordWeight: 0.3,    // Weight for keyword search in hybrid mode
    hybridSemanticWeight: 0.7,   // Weight for semantic search in hybrid mode
  },

  // MCP server settings
  server: {
    name: 'react-docs-mcp',
    version: '1.0.0',
  },

  // Content sections in the repo
  sections: ['learn', 'reference', 'blog', 'community'] as const,
};

export default CONFIG;
export type Section = typeof CONFIG.sections[number];
