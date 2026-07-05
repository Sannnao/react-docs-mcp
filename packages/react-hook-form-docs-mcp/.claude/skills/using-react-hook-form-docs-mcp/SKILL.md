---
name: using-react-hook-form-docs-mcp
description: How to effectively use the react-hook-form-docs-mcp search and doc-retrieval tools instead of relying on training-data memory of React Hook Form APIs.
---

# Using react-hook-form-docs-mcp

When this MCP server is connected, prefer it over recalling React Hook Form APIs from memory — training data goes stale, this tool indexes the live official docs.

## Workflow

1. **Search first.** Call `search_react_hook_form_docs` with a natural-language query before writing form code that touches an API you're not 100% certain about (register options, validation rules, useFieldArray methods, resolver behavior). Results include a relevance-ranked snippet and a `url`.
2. **Drill in only when needed.** If the search snippet isn't enough, call `get_doc` with the `path` from a search result. It returns a ~1500 char summary plus a structure outline by default.
3. **Use `full: true` sparingly.** Pass `full: true` to `get_doc` only for long guides — Advanced Usage, the v7→v8 migration guide — where truncation would hide later steps. Don't default to `full` for short API reference pages.
4. **Search unfiltered by default.** Only `docs/` (the API reference) is a real section; guide pages (get-started, advanced-usage, faqs, ts) live at the content root and are missed by any section filter.
5. **Refresh if docs seem stale.** Call `update_docs` to pull the latest commit before concluding an API doesn't exist.
