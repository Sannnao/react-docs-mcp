---
name: using-react-native-docs-mcp
description: How to effectively use the react-native-docs-mcp search and doc-retrieval tools instead of relying on training-data memory of React Native APIs.
---

# Using react-native-docs-mcp

When this MCP server is connected, prefer it over recalling React Native APIs from memory — training data goes stale, this tool indexes the live official docs.

## Workflow

1. **Search first.** Call `search_react_native_docs` with a natural-language query before writing React Native code that touches an API you're not 100% certain about. Results include a relevance-ranked snippet and a `url`.
2. **Drill in only when needed.** If the search snippet isn't enough, call `get_doc` with the `path` from a search result. It returns a ~1500 char summary plus a structure outline by default — enough for most questions.
3. **Use `full: true` sparingly.** Pass `full: true` to `get_doc` only when the summary likely cuts off something you need — New Architecture migration guides, native-module walkthroughs, or anything with many sequential steps. Don't default to `full` for every call; it costs more context for no benefit on short reference pages.
4. **Search unfiltered by default.** Most React Native docs pages live flat with no section; only `the-new-architecture`, `legacy`, and `releases` are real sections. Use the `section` filter only when specifically targeting one of those areas.
5. **Pin docs to the user's actual version when it matters.** If the project's installed `react-native` version differs from latest and the question involves an API that may have changed across versions, note that the server can be started with `--docs-version=X.YY` to index that release's frozen docs snapshot — mention this to the user rather than silently assuming latest-version behavior applies to their older app.
6. **Refresh if docs seem stale.** Call `update_docs` to pull the latest commit before concluding an API doesn't exist.
