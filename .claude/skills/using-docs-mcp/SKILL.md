---
name: using-docs-mcp
description: How to effectively use the react-docs-mcp / react-native-docs-mcp search and doc-retrieval tools instead of relying on training-data memory of React/React Native APIs.
---

# Using react-docs-mcp / react-native-docs-mcp

When these MCP servers are connected, prefer them over recalling React or React Native APIs from memory — training data goes stale, these tools index the live docs repo.

## Workflow

1. **Search first.** Call `search_react_docs` (or `search_react_native_docs`) with a natural-language query before writing any React/React Native code that touches an API you're not 100% certain about. Results include a relevance-ranked snippet and a `url`.
2. **Drill in only when needed.** If the search snippet isn't enough, call `get_doc` with the `path` from a search result. It returns a ~1500 char summary plus a structure outline by default — enough for most questions.
3. **Use `full: true` sparingly.** Pass `full: true` to `get_doc` only when the summary likely cuts off something you need — long migration/upgrade guides, multi-step setup pages, or anything with many sequential steps where truncation would hide later steps. Don't default to `full` for every call; it costs more context for no benefit on short reference pages.
4. **Filter by section when you know the area.** `section` narrows results (e.g. `learn`/`reference`/`blog`/`community` for React; `the-new-architecture`/`legacy`/`releases` for React Native). For React Native, most pages have no section — search unfiltered unless you're specifically after one of those three areas.
5. **Pin React Native docs to the user's actual version when it matters.** If the project's installed `react-native` version is known and differs from latest, and the question is about an API that may have changed across versions, note that `react-native-docs-mcp` can be started with `--docs-version=X.YY` to index that release's frozen docs snapshot instead of always-current — mention this to the user rather than silently assuming latest-version behavior applies to their older app.
6. **Refresh if docs seem stale or contradict recent framework changes.** Call `update_docs` to pull the latest commit before concluding an API doesn't exist.
