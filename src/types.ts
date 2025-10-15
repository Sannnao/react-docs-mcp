/**
 * types.ts
 * Define all TypeScript interfaces and types used across the project
 */

/**
 * Document metadata parsed from frontmatter
 */
export interface DocMetadata {
  title: string;
  description?: string;
  date?: string;
  author?: string;
  tags?: string[];
  [key: string]: unknown; // Additional frontmatter fields
}

/**
 * Parsed document with content and metadata
 */
export interface ParsedDoc {
  path: string;           // Relative path from content root
  section: string;        // Section name (learn, reference, blog)
  metadata: DocMetadata;
  content: string;        // Raw markdown content
  plainText: string;      // Stripped text for search
  embedding?: number[];   // Vector embedding for semantic search
}

/**
 * Search result with relevance
 */
export interface SearchResult {
  doc: ParsedDoc;
  score: number;          // Relevance score
  snippet: string;        // Context snippet with match
}

/**
 * Search options
 */
export interface SearchOptions {
  section?: string;       // Filter by section
  limit?: number;         // Max results (default: 10)
  minScore?: number;      // Minimum relevance score
  useSemanticSearch?: boolean; // Use vector embeddings for semantic search
}

/**
 * Git repository status
 */
export interface RepoStatus {
  isCloned: boolean;
  lastUpdated?: Date;
  currentCommit?: string;
}
