# React Native Docs MCP Server

AI-powered semantic search over React Native documentation for Claude, Cursor, and other MCP clients.

Looking for React docs instead? See [react-docs-mcp](https://www.npmjs.com/package/react-docs-mcp).

## 🚀 Installation (One Command)

### Claude Code

```bash
claude mcp add --transport stdio react-native-docs -- npx react-native-docs-mcp
```

### Claude Desktop

Edit: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "react-native-docs": {
      "command": "npx",
      "args": ["-y", "react-native-docs-mcp"]
    }
  }
}
```

### Cursor

**Settings** → **Cursor settings** → **Tools and MCP** → Add server:

```json
{
  "mcpServers": {
    "react-native-docs": {
      "command": "npx",
      "args": ["-y", "react-native-docs-mcp"]
    }
  }
}
```

**That's it!** Restart your editor and ask about React Native.

---

## Features

- **🔍 Semantic Search**: AI-powered search using embeddings for conceptual matches
- **⚡ Fast Results**: In-memory vector search with hybrid keyword+semantic ranking
- **📦 Zero Config**: Works with `npx` - no installation needed
- **🤖 Local AI**: Runs embeddings locally (no API costs)
- **📝 Concise Responses**: Returns summaries instead of full documentation
- **🔄 Auto-sync**: Pulls latest docs from the react-native-website repo automatically

## Usage

Once configured, the server provides the following capabilities to AI agents:

### Tools

#### `search_react_native_docs`

Search across React Native documentation.

**Parameters**:

- `query` (required): Search query string
- `section` (optional): Filter by section (the-new-architecture, legacy, releases)
- `limit` (optional): Maximum number of results (default: 10, max: 50)

**Example**:

```
Search for "flexbox layout" in React Native docs
```

#### `get_doc`

Get a specific documentation page.

**Parameters**:

- `path` (required): Document path (e.g., "getting-started", "the-new-architecture/using-codegen")

**Example**:

```
Get the React Native flexbox documentation
```

#### `list_sections`

List all available documentation sections.

#### `update_docs`

Pull latest documentation from the Git repository.

### Resources

The server exposes documentation as resources with the URI pattern:

```
react-native-docs://{section}/{path}
```

## Limitations

- **Docs source**: content is cloned from the unversioned `docs/` folder in [facebook/react-native-website](https://github.com/facebook/react-native-website), which is upstream's live editing source. It may occasionally be a few days ahead of the latest published release rather than pinned to a specific React Native version.
- **Sections**: most React Native docs pages live flat at the root of `docs/` with no meaningful section — only `the-new-architecture`, `legacy`, and `releases` are real subfolders. The `section` filter reliably narrows results only for those three; for everything else, search unfiltered.
- **Blog posts**: `website/blog/` is not indexed yet.
- **MDX rendering**: `.mdx`-only syntax (JSX component imports, admonitions) is stripped as best-effort plain text for search indexing, so snippets/summaries for some pages may include stray import lines.

## Development

This package shares its engine (`src/`) with the root [react-docs-mcp](../../) project in this repo — see that project's README for the underlying architecture. This package's own source only configures the shared engine with React Native-specific defaults (`src/index.ts`) and is bundled standalone with [tsup](https://tsup.egoist.dev/).

```bash
npm install
npm run build
npm run dev   # run directly with tsx, no build step
```

## License

MIT. React Native documentation content is © Meta Platforms, Inc. and licensed separately by the [react-native-website](https://github.com/facebook/react-native-website) project.
