/**
 * reactDocs.ts
 * Preset for the default react-docs-mcp package: github.com/reactjs/react.dev.git
 */

import type { DocsMcpPreset } from '../config.js';
import { DEFAULT_SEARCH } from './searchDefaults.js';

export const reactDocsPreset: DocsMcpPreset = {
  cacheDirName: 'react-docs-mcp',
  repoFolderName: 'react-dev-repo',
  repo: {
    url: 'https://github.com/reactjs/react.dev.git',
    contentPath: 'src/content',
  },
  search: { ...DEFAULT_SEARCH },
  server: {
    name: 'react-docs-mcp',
    version: '1.2.0',
  },
  sections: ['learn', 'reference', 'blog', 'community'],
  resourceUriScheme: 'react-docs',
  docsLabel: 'React',
  searchToolName: 'search_react_docs',
  searchToolDescription: 'Search across React documentation. Returns relevant documentation pages with snippets.',
  pathExample: 'reference/react/useState',
  docUrl: { base: 'https://react.dev', useFrontmatterId: false },
  sectionResourceOverrides: {
    learn: {
      name: 'React Learn Documentation',
      description: 'Interactive React tutorial and learning materials',
    },
    reference: {
      name: 'React API Reference',
      description: 'Complete React API reference documentation',
    },
    blog: {
      name: 'React Blog',
      description: 'React team blog posts and announcements',
    },
    community: {
      name: 'React Community Documentation',
      description: 'Community resources, code of conduct, and translations',
    },
  },
};
