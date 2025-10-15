# React Docs MCP Server - Technical Specification

## Overview

An MCP (Model Context Protocol) server that provides AI coding agents with programmatic access to React documentation from the official `reactjs/react.dev` repository.

## Architecture

### System Design

```
┌─────────────────┐
│   MCP Client    │ (Claude Desktop, Claude Code, etc.)
│  (AI Agent)     │
└────────┬────────┘
         │ MCP Protocol
         │
┌────────▼────────┐
│   MCP Server    │
│   (index.ts)    │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────┐
    │         │          │          │
┌───▼───┐ ┌──▼──┐ ┌─────▼─────┐ ┌──▼──────┐
│ Docs  │ │Parse│ │  Search   │ │ Config  │
│Manager│ │ MD  │ │  Engine   │ │         │
└───┬───┘ └─────┘ └───────────┘ └─────────┘
    │
┌───▼──────────┐
│ Local Git    │
│ react.dev    │
│ Repository   │
└──────────────┘
```

## Module Specifications

### 1. types.ts

**Purpose**: Define all TypeScript interfaces and types used across the project.

**Exports**:

```typescript
// Document metadata parsed from frontmatter
interface DocMetadata {
  title: string;
  description?: string;
  date?: string;
  author?: string;
  tags?: string[];
  [key: string]: unknown; // Additional frontmatter fields
}

// Parsed document with content and metadata
interface ParsedDoc {
  path: string;           // Relative path from content root
  section: string;        // Section name (learn, reference, blog)
  metadata: DocMetadata;
  content: string;        // Raw markdown content
  plainText: string;      // Stripped text for search
}

// Search result with relevance
interface SearchResult {
  doc: ParsedDoc;
  score: number;          // Relevance score
  snippet: string;        // Context snippet with match
}

// Search options
interface SearchOptions {
  section?: string;       // Filter by section
  limit?: number;         // Max results (default: 10)
  minScore?: number;      // Minimum relevance score
}

// Git repository status
interface RepoStatus {
  isCloned: boolean;
  lastUpdated?: Date;
  currentCommit?: string;
}
```

### 2. config.ts

**Purpose**: Centralize configuration constants.

**Exports**:

```typescript
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
```

### 3. docsManager.ts

**Purpose**: Handle Git repository operations and file system access.

**Class**: `DocsManager`

**Methods**:

```typescript
class DocsManager {
  /**
   * Initialize the docs manager
   * Checks if repo exists, clones if needed
   */
  async initialize(): Promise<void>

  /**
   * Get repository status
   */
  async getStatus(): Promise<RepoStatus>

  /**
   * Update repository (git pull)
   * Returns true if updates were pulled
   */
  async updateRepo(): Promise<boolean>

  /**
   * Get all markdown files from a section
   * @param section - Section name (learn, reference, etc.)
   * @returns Array of file paths relative to content root
   */
  async getDocsInSection(section: string): Promise<string[]>

  /**
   * Get all markdown files across all sections
   * @returns Array of file paths relative to content root
   */
  async getAllDocs(): Promise<string[]>

  /**
   * Read file content
   * @param relativePath - Path relative to content root
   * @returns Raw file content
   */
  async readDoc(relativePath: string): Promise<string>

  /**
   * Check if file exists
   * @param relativePath - Path relative to content root
   */
  async docExists(relativePath: string): Promise<boolean>
}
```

**Implementation Notes**:
- Use `simple-git` for Git operations
- Use Node.js `fs.promises` for file operations
- Use `fast-glob` for finding markdown files
- Cache file lists to avoid repeated filesystem scans
- Handle errors gracefully (network issues, file not found, etc.)

### 4. markdownParser.ts

**Purpose**: Parse markdown files and extract metadata and content.

**Function Exports**:

```typescript
/**
 * Parse a markdown file
 * @param content - Raw markdown content
 * @param path - File path for context
 * @returns Parsed document with metadata and content
 */
async function parseMarkdown(
  content: string,
  path: string
): Promise<ParsedDoc>

/**
 * Strip markdown formatting to plain text
 * Used for search indexing
 * @param markdown - Markdown content
 * @returns Plain text
 */
function markdownToPlainText(markdown: string): Promise<string>

/**
 * Extract section from file path
 * E.g., "learn/hooks/useState.md" -> "learn"
 */
function extractSection(path: string): string
```

**Implementation Notes**:
- Use `gray-matter` to parse frontmatter
- Use `remark` with `remark-strip-markdown` for plain text extraction
- Handle files without frontmatter gracefully
- Normalize paths (forward slashes, no leading slash)

### 5. searchEngine.ts

**Purpose**: Implement search functionality over documentation.

**Class**: `SearchEngine`

**Methods**:

```typescript
class SearchEngine {
  /**
   * Initialize search engine
   * @param docsManager - Instance of DocsManager
   */
  constructor(docsManager: DocsManager)

  /**
   * Index all documents for searching
   * Should be called after repo update
   */
  async indexDocuments(): Promise<void>

  /**
   * Search documents
   * @param query - Search query string
   * @param options - Search options (section filter, limit, etc.)
   * @returns Ranked search results
   */
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]>

  /**
   * Get document by exact path
   * @param path - Document path relative to content root
   * @returns Parsed document or null if not found
   */
  async getDocByPath(path: string): Promise<ParsedDoc | null>

  /**
   * List all available sections
   */
  getSections(): string[]

  /**
   * Get all documents in a section
   */
  async getDocsBySection(section: string): Promise<ParsedDoc[]>
}
```

**Implementation Notes**:
- Use simple keyword-based search (case-insensitive)
- Score by: keyword frequency, title matches (higher weight), position in text
- Generate context snippets showing matched text (±50 chars)
- Keep in-memory index of all documents for fast search
- Re-index on update

### 6. index.ts

**Purpose**: MCP server entry point implementing the protocol.

**MCP Resources**:

```typescript
// Resource URI pattern: react-docs://{section}/{path}
// Examples:
//   react-docs://learn/hooks/useState
//   react-docs://reference/react/Component
//   react-docs://blog/2023/03/16/introducing-react-dev

// Resource handler returns document content in markdown format
```

**MCP Tools**:

```typescript
/**
 * Tool: search_react_docs
 * Search across React documentation
 *
 * Input schema (Zod):
 * {
 *   query: string (required),
 *   section: string (optional),
 *   limit: number (optional, default: 10, max: 50)
 * }
 *
 * Output: Array of search results with:
 * - path: string
 * - title: string
 * - snippet: string
 * - score: number
 * - url: string (link to react.dev)
 */

/**
 * Tool: list_sections
 * List available documentation sections
 *
 * Input: none
 *
 * Output: Array of section names
 */

/**
 * Tool: get_doc
 * Get specific document by path
 *
 * Input schema:
 * {
 *   path: string (required) // e.g., "learn/hooks/useState"
 * }
 *
 * Output: Full document with metadata and content
 */

/**
 * Tool: update_docs
 * Pull latest documentation from Git
 *
 * Input: none
 *
 * Output:
 * {
 *   updated: boolean,
 *   message: string
 * }
 */
```

**Server Implementation**:

```typescript
// Initialize DocsManager and SearchEngine on startup
// Register resources and tools with MCP SDK
// Handle requests and responses
// Implement proper error handling
// Use Zod for input validation
```

## Error Handling Strategy

### Categories

1. **Initialization Errors**
   - Git clone failure → Retry with backoff, clear message
   - Permissions issues → Clear error message with fix suggestion

2. **Runtime Errors**
   - File not found → Return null/empty, log warning
   - Git pull failure → Use cached data, warn user
   - Invalid input → Return validation error via Zod

3. **Search Errors**
   - Empty query → Return empty results
   - Invalid section → Return error with valid sections list

### Logging

- Use structured logging (consider `pino` or simple console with levels)
- Log levels: ERROR, WARN, INFO, DEBUG
- Include context (operation, parameters, timestamp)

## Data Flow Examples

### Example 1: Client searches for "useState"

```
1. Client calls tool: search_react_docs({ query: "useState", limit: 5 })
2. Server validates input with Zod
3. SearchEngine.search() called
4. Searches indexed documents, scores by keyword match
5. Returns top 5 results with snippets
6. Server formats response per MCP protocol
7. Client receives results
```

### Example 2: Client requests specific resource

```
1. Client requests: react-docs://learn/hooks/useState
2. Server parses URI
3. SearchEngine.getDocByPath("learn/hooks/useState") called
4. DocsManager reads file
5. MarkdownParser parses content
6. Returns full markdown content to client
```

## Performance Considerations

- **Lazy Loading**: Only index documents on first search or explicit request
- **Caching**: Keep parsed documents in memory
- **Incremental Updates**: On git pull, only re-parse changed files (future enhancement)
- **Async Operations**: All I/O operations are async/await

## Future Enhancements

1. **Vector Search**: Use embeddings for semantic search (ChromaDB, FAISS)
2. **Incremental Indexing**: Track git changes, only re-index modified files
3. **Caching Layer**: Redis/SQLite for persistent cache
4. **Multiple Versions**: Support different React versions
5. **Code Examples Extraction**: Parse and index code blocks separately
6. **Auto-update**: Background task to pull updates periodically

## Development Workflow

1. Write this spec
2. Validate spec for completeness
3. Implement each module in order: types → config → docsManager → markdownParser → searchEngine → index
4. Test each module independently
5. Integration testing with MCP Inspector
6. Configure for Claude Desktop/Code
7. Document setup in README

## Testing Strategy

- **Unit Tests**: Each module tested independently (future)
- **Integration Tests**: Test with MCP Inspector
- **Manual Tests**: Use with Claude Desktop

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^latest",
  "simple-git": "^3.x",
  "gray-matter": "^4.x",
  "remark": "^15.x",
  "remark-strip-markdown": "^6.x",
  "fast-glob": "^3.x",
  "zod": "^3.x"
}
```

## File Structure

```
reactDocsMcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── docsManager.ts        # Git & file operations
│   ├── markdownParser.ts     # MD parsing
│   ├── searchEngine.ts       # Search implementation
│   ├── types.ts              # TypeScript definitions
│   └── config.ts             # Configuration
├── data/
│   └── react-dev-repo/       # Git clone (gitignored)
├── dist/                     # Compiled JS (gitignored)
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md                 # User-facing docs
└── TECHNICAL_SPEC.md         # This file
```

---

**End of Technical Specification**
