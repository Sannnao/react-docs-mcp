<p align="center">
  <img src="https://raw.githubusercontent.com/Sannnao/react-docs-mcp/master/poster.png" width="100%" alt="React Hook Form Docs MCP">
</p>

# React Hook Form Docs MCP Server

AI-powered semantic search over React Hook Form documentation for Claude, Cursor, and other MCP clients.

Also available — same engine, other docs: [react-docs-mcp](https://www.npmjs.com/package/react-docs-mcp) (React) and [react-native-docs-mcp](https://www.npmjs.com/package/react-native-docs-mcp) (React Native).

## 🚀 Installation (One Command)

### Claude Code

```bash
claude mcp add --transport stdio react-hook-form-docs -- npx react-hook-form-docs-mcp
```

### Claude Desktop

Edit: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "react-hook-form-docs": {
      "command": "npx",
      "args": ["-y", "react-hook-form-docs-mcp"]
    }
  }
}
```

### Cursor

**Settings** → **Cursor settings** → **Tools and MCP** → Add server:

```json
{
  "mcpServers": {
    "react-hook-form-docs": {
      "command": "npx",
      "args": ["-y", "react-hook-form-docs-mcp"]
    }
  }
}
```

**That's it!** Restart your editor and ask about React Hook Form.

---

## Features

- **🔑 No API Key**: Unlike hosted docs services (Context7, GitMCP), everything runs on your machine — no account, no key, no rate limits
- **🔌 Works Offline**: Clones the official react-hook-form documentation repo once, then searches locally — no network calls at query time
- **🔍 Semantic Search**: AI-powered search using embeddings for conceptual matches
- **⚡ Fast Results**: In-memory vector search with hybrid keyword+semantic ranking
- **📦 Zero Config**: Works with `npx` - no installation needed
- **🤖 Local AI**: Runs embeddings locally (no API costs)
- **📝 Concise Responses**: Returns summaries instead of full documentation
- **🔄 Auto-sync**: Pulls latest docs from the official documentation repo automatically

## Usage

Once configured, the server provides the following capabilities to AI agents:

### Tools

#### `search_react_hook_form_docs`

Search across React Hook Form documentation.

**Parameters**:

- `query` (required): Search query string
- `section` (optional): Filter by section (`docs` — the API reference; guides like get-started live at the root, so search unfiltered by default)
- `limit` (optional): Maximum number of results (default: 10, max: 50)

**Example**:

```
Search React Hook Form docs for "validate a field against another field"
```

#### `get_doc`

Get a specific documentation page.

**Parameters**:

- `path` (required): Document path (e.g., "docs/useform", "get-started")
- `full` (optional): Return the full raw page instead of the ~1500 char summary (default: false)

**Why `full`?** The default summary covers most API lookups, but long guides — Advanced Usage, the v7→v8 migration guide — can run past 1500 chars. Ask for the complete page when the summary cuts off:

```
Get the full content of the React Hook Form advanced usage guide
```

#### `list_sections`

List all available documentation sections.

#### `update_docs`

Pull latest documentation from the Git repository.

### CLI

```bash
npx react-hook-form-docs-mcp --version   # print the installed package version and exit
```

### Resources

The server exposes documentation as resources with the URI pattern:

```
react-hook-form-docs://{section}/{path}
```

## Limitations

- **Sections**: only `docs/` (the API reference) is a real section; guide pages (get-started, advanced-usage, faqs, ts, migrate-v7-to-v8) live at the content root — search unfiltered to cover everything.
- **MDX rendering**: `.mdx`-only syntax (JSX component imports) is stripped as best-effort plain text for search indexing, so snippets for some pages may include stray import lines.

## Development

This package shares its engine with [react-docs-mcp](https://github.com/Sannnao/react-docs-mcp) — development happens in that monorepo (this standalone repo is a read-only mirror of `packages/react-hook-form-docs-mcp/`; please file issues there). This package's own source only configures the shared engine with React Hook Form-specific defaults (`src/index.ts`) and is bundled standalone with [tsup](https://tsup.egoist.dev/).

```bash
npm install
npm run build
npm run dev   # run directly with tsx, no build step
```

## License

MIT. React Hook Form documentation content is licensed separately by the [react-hook-form/documentation](https://github.com/react-hook-form/documentation) project.
