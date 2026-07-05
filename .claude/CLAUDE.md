# docs-mcp Codebase Reference

## Architecture Overview

MCP servers: stdio transport, @modelcontextprotocol/sdk
Purpose: local semantic search over docs repos, published as two thin preset packages sharing one engine:
- `react-docs-mcp` (repo root package) — reactjs/react.dev
- `react-native-docs-mcp` (packages/react-native-docs-mcp, bundled standalone via tsup) — facebook/react-native-website

A preset (`DocsMcpPreset`) fully describes a docs source; each package's entrypoint calls `configure(preset)` then `createServer()`. Engine code reads config via the live-binding default export of config.ts.

## Component Map

### config.ts (preset-driven config)
- Interfaces: SearchConfig, DocUrlConfig, SectionResourceOverride, DocsMcpPreset
- DocsMcpConfig = derived type (Omit of preset + repo.localPath) — do NOT hand-copy fields
- getCacheDir(cacheDirName): OS cache dir (~/.cache/<name> on mac/linux, LOCALAPPDATA on win)
- configure(preset): swaps module-level activeConfig; MUST run before any engine use
- `export { activeConfig as default }` — ESM live binding; seeded from reactDocsPreset (no duplicate defaults)

### presets/
- searchDefaults.ts: DEFAULT_SEARCH (single source of search tuning: defaultLimit=10, maxLimit=50, minScore=0.1, semanticMinSimilarity=0.3, hybrid weights 0.3/0.7)
- reactDocs.ts: reactDocsPreset (react.dev, contentPath src/content, sections learn/reference/blog/community, useFrontmatterId=false, sectionResourceOverrides incl. community)
- reactNativeDocs.ts: resolveReactNativeDocsPreset(version='latest'), LATEST_VERSION
  - validates version format (\d+.\d+ or 'latest'), throws on malformed
  - latest → contentPath 'docs'; pinned → 'website/versioned_docs/version-X.YY' (same clone)
  - useFrontmatterId=true for ALL versions (Docusaurus routes by frontmatter id)

### index.ts (root entrypoint, react-docs-mcp)
- Handles --version/-v: prints package version, exits (package.json postinstall depends on this!)
- configure(reactDocsPreset); createServer().catch → exit(1)

### packages/react-native-docs-mcp/src/index.ts (RN entrypoint)
- --version/-v prints version and exits
- --docs-version=X.YY or REACT_NATIVE_DOCS_VERSION env (CLI wins) → resolveReactNativeDocsPreset(version)
- parseDocsVersionArg rejects values starting with '-'
- Bundled by tsup (relative imports ../../../src/*), deps mirrored by hand in its package.json

### server.ts (MCP protocol, shared)
- createServer(): constructs DocsManager+SearchEngine (AFTER configure), Server, all handlers, stdio connect
- buildDocUrl(doc) = `${CONFIG.docUrl.base}/${doc.path}` — doc.path IS the canonical slug (id resolved at index time)
- resourceUriRegex built with escapeRegExp(CONFIG.resourceUriScheme)
- searchDocsSchema: section validated (zod refine) against CONFIG.sections with helpful message
- getDocSchema: path (example from CONFIG.pathExample), full?:boolean
- ListResources + list_sections use docsManager.getExistingSections(CONFIG.sections) — only sections present on disk are advertised
- get_doc: default = summarizeContent(1500) + extractStructure; full:true = raw doc.content
- update_docs: git pull; re-runs indexDocuments() when changed

### docsManager.ts (git/fs ops)
- Constructor captures CONFIG.repo.* (safe: constructed only inside createServer after configure)
- initialize(): clone if missing, then VALIDATES contentPath exists (fail-loud for bad --docs-version)
- cloneRepo(): clones to `${repoPath}.cloning-<pid>` then renames — concurrent-process safe; loser discards temp copy
- getExistingSections(sections): fs.access filter of section dirs
- getDocsInSection/getAllDocs: fg(['**/*.md','**/*.mdx'], ignore ['**/_*.md','**/_*.mdx']) — mdx included, Docusaurus partials excluded
- updateRepo(): pull, clears fileCache on change

### searchEngine.ts (indexing/search)
- resolveDocSlug(path, id): exported; replaces last segment with frontmatter id (string only), whole path if id has '/'
- indexDocuments(): parse each doc; if CONFIG.docUrl.useFrontmatterId, rewrites parsedDoc.path via resolveDocSlug; sets embeddingsGenerated=false (embeddings must regenerate after re-index — critical for update_docs)
- getDocByPath(path): normalizePath(path) (markdownParser's — handles backslash/leading-slash/.mdx?) then index lookup
- search: hybrid keyword+semantic as before (weights from CONFIG.search)

### markdownParser.ts
- Exports: parseMarkdown, markdownToPlainText, extractSection, normalizePath, titleCase
- normalizePath strips backslashes, leading slashes, .md/.mdx
- titleCase shared by extractTitleFromPath and server resource names

### embeddingService.ts / summarizer.ts / types.ts — unchanged from original design (Xenova/all-MiniLM-L6-v2, 384 dims; summary 1500 chars)

## MCP Tools (names are preset-driven)

1. search_react_docs / search_react_native_docs: query, section? (validated), limit?
   → [{path, title, snippet, score, url}] — url/path use id-resolved slugs
2. list_sections → sections existing on disk
3. get_doc: path, full? → summary+structure (default) or raw content (full:true); url via buildDocUrl
4. update_docs → {updated, message}; re-index resets embeddings flag

## Testing

- vitest, src/__tests__/: config-sensitive tests call configure(preset) and restore reactDocsPreset in afterEach
- searchEngine.test partial-mocks markdownParser (parseMarkdown stubbed, normalizePath real)
- docsManager.test fs mock includes rename/rm (clone-race tests)
- presets.test covers version validation + preset field sanity

## Publishing

- Root: npm publish from repo root (tsc build). RN: npm publish from packages/react-native-docs-mcp (tsup build)
- Both dependency lists are hand-duplicated — bump together
- postinstall runs `node dist/index.js --version` — keep the --version fast-exit in index.ts
- CI: .github/workflows/test.yml — root build+test (Node 18/20, npm ci), RN build (npm ci)

## Adding a new library preset/package

Follow .claude/skills/add-docs-preset/SKILL.md — feasibility check (clonable markdown? frontmatter ids? versioned?), preset file, scaffold copied from packages/react-hook-form-docs-mcp, tests, JSON-RPC smoke with live-URL spot-checks, publish + mirror repo.

## Gotchas

- Never construct DocsManager/SearchEngine before configure() — constructor captures repo paths
- config.ts must not runtime-import anything that runtime-imports config.ts (presets use type-only imports + searchDefaults.ts to avoid cycles)
- react.dev preset behavior is frozen for backward compat: useFrontmatterId=false, same cache dir/tool names/URI scheme as v1.0.x
- RN 'latest' content may be briefly ahead of the published site; blog/ not indexed (v1 scope)
