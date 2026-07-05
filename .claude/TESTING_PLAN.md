# Unit Testing Plan - react-docs-mcp

## Setup Required
Framework: Vitest
DevDeps: vitest, @vitest/ui, nock, memfs
Scripts: test, test:watch, test:coverage

## Module Coverage

### markdownParser.ts (Priority: HIGH, Target: 90%)
parseMarkdown(): valid/invalid frontmatter, title extraction, plainText conversion
markdownToPlainText(): strip formatting, normalize whitespace
extractSection(): path parsing, backslash handling
normalizePath(): slash normalization, .md removal
extractTitleFromPath(): kebab/snake case to Title Case
Mocks: none (pure functions)

### summarizer.ts (Priority: HIGH, Target: 85%)
summarizeContent(): truncation, code block removal, paragraph extraction, heading structure, maxLength handling
extractStructure(): h1-h3 extraction, first line capture, formatting
Mocks: none (pure functions)

### embeddingService.ts (Priority: HIGH, Target: 80%)
initialize(): pipeline init, initialized flag, error handling
generateEmbedding(): text truncation (2000), 384-dim array output, auto-init
generateEmbeddings(): batch processing
cosineSimilarity(): identical (1), orthogonal (0), opposite (-1), length mismatch error, zero magnitude
findMostSimilar(): top K sorting, empty array handling
Mocks: @xenova/transformers pipeline, env

### docsManager.ts (Priority: HIGH, Target: 85%)
initialize(): skip if exists, clone if missing
checkRepoExists(): .git check
cloneRepo(): parent dir creation, --depth 1, error handling
getStatus(): isCloned, commit hash, lastUpdated, log failure
updateRepo(): not cloned error, git.pull, hash comparison, fileCache clearing
getDocsInSection(): caching, fast-glob *.md, relative paths, non-existent section
getAllDocs(): caching, all *.md files
readDoc(): file read, error on missing, UTF-8
docExists(): fs.access check
Mocks: simple-git, fs.promises, fast-glob

### searchEngine.ts (Priority: CRITICAL, Target: 90%)
indexDocuments(): clear, getAllDocs, parseMarkdown, populate Map, indexed=true, error handling
generateEmbeddings(): skip if done, init service, title+desc+1000chars, embedding storage, progress logging
search(): auto-index, empty query, semantic vs keyword routing
keywordSearch(): term splitting, scoreDocument, section filter, minScore filter, sort desc, limit, snippet generation
semanticSearch(): auto-embeddings, query embedding, keyword score /100, cosineSimilarity, hybrid (0.3*kw + 0.7*sem), minSimilarity filter (0.3), sort, limit
scoreDocument(): title +10, path +5, description +3, plainText +0.5/match, case insensitive
generateSnippet(): first match, ±75 chars, ellipsis, description fallback, 150 char fallback
getDocByPath(): auto-index, normalize .md, Map lookup, null handling
getSections(): CONFIG.sections return
getDocsBySection(): auto-index, case insensitive filter
Mocks: DocsManager, EmbeddingService, parseMarkdown

### index.ts (Priority: MEDIUM, Target: 70%)
Server init: name/version, capabilities
ListResourcesRequestSchema: 3 resources (learn/reference/blog), URI react-docs://*
ReadResourceRequestSchema: URI parse, section list vs specific doc, error handling
ListToolsRequestSchema: 4 tools, schemas, descriptions
CallToolRequestSchema:
  - search_react_docs: zod validation, searchEngine.search, JSON format
  - list_sections: getSections
  - get_doc: validation, getDocByPath, summarizeContent, extractStructure, JSON
  - update_docs: updateRepo, re-index if updated
  - ZodError handling
main(): docsManager.initialize, transport connect, exit(1) on error
Mocks: DocsManager, SearchEngine, StdioServerTransport, Server

## Test Files Structure
src/__tests__/markdownParser.test.ts
src/__tests__/summarizer.test.ts
src/__tests__/embeddingService.test.ts
src/__tests__/docsManager.test.ts
src/__tests__/searchEngine.test.ts
src/__tests__/index.test.ts
src/__tests__/helpers/fixtures.ts (sample data)
src/__tests__/helpers/mocks.ts (mock factories)

## Coverage Targets
Overall: 80%+
searchEngine.ts: 90%+ (critical path)

## Implementation Order
1. Setup + pure functions (markdownParser, summarizer)
2. Core services (embeddingService, docsManager)
3. Business logic (searchEngine)
4. Integration (index.ts)

## Critical Mocking
- Filesystem: memfs or mock fs.promises
- Git: mock simple-git (clone, pull, log, revparse)
- Transformers: mock pipeline (too slow for tests)
- Fast-glob: return fixture paths

## Key Test Scenarios
- Empty/invalid inputs
- Cache behavior (fileCache, documentIndex)
- Lazy initialization (embeddings)
- Error propagation
- Hybrid scoring calculation
- Section filtering
- Path normalization edge cases
