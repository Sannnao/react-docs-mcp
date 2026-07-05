---
name: add-docs-preset
description: Procedure for adding a new docs MCP package (a new library preset) to this monorepo — feasibility check, preset file, package scaffold, tests, smoke test, publish, mirror. Use when asked to create an MCP server for another library's documentation (e.g. "add a docs MCP for <library>").
---

# Adding a new docs MCP package

A new docs server = one preset file + a thin package scaffold on the shared engine. Existing examples: `src/presets/reactDocs.ts` (root package), `src/presets/reactNativeDocs.ts` + `packages/react-native-docs-mcp/` (versioned docs), `src/presets/reactHookFormDocs.ts` + `packages/react-hook-form-docs-mcp/` (simplest case — copy this one as your template).

## 1. Feasibility check — NEVER skip

The engine requires a **git repo containing markdown/MDX docs**. Rendered-HTML-only docs sites don't fit — stop and say so.

Shallow-clone the candidate repo into the scratchpad (never into this project) and determine:

- **Content root**: where do the actual doc files live? Don't guess — grep the site config (Docusaurus `docs: { path: ... }` in docusaurus.config.*, contentlayer.config.ts, astro/nextra config). react.dev uses `src/content`, react-native-website uses root `docs/`, react-hook-form uses `src/content`.
- **File mix**: count `.md` vs `.mdx` (both supported). Check for `_`-prefixed partial files (auto-excluded by the glob).
- **Sections**: which subfolders of the content root are real sections vs flat files? Only real subfolders go in `sections` (the server filters to existing dirs at runtime anyway).
- **Frontmatter `id` overrides** (the RN lesson — this caused real wrong-URL bugs): `grep -rn "^id:"` in the content root. If files set an `id` differing from their filename, Docusaurus-style sites route by id → set `useFrontmatterId: true`. **Verify 2-3 sample URLs against the live site** either way; a valid-looking URL scheme that 404s or serves the wrong page is the failure mode to catch here.
- **Versioned docs**: is there a `versioned_docs/`-style folder? Only then does the package need a `--docs-version` flag (copy the pattern from `packages/react-native-docs-mcp/src/index.ts`, including version-format validation).

Also: `npm view <lib>-docs-mcp version` must 404 (name unclaimed).

## 2. Preset file: `src/presets/<lib>Docs.ts`

Copy `reactHookFormDocs.ts`. Rules:

- `import type { DocsMcpPreset } from '../config.js'` — **type-only**; a runtime import of config.ts from a preset creates a cycle (config.ts runtime-imports reactDocs.ts).
- `search: { ...DEFAULT_SEARCH }` from `./searchDefaults.js` — never inline tuning values.
- Naming conventions (keep them boring and consistent):
  | field | pattern | example |
  |---|---|---|
  | cacheDirName | `<lib>-docs-mcp` | `react-hook-form-docs-mcp` |
  | repoFolderName | `<repo-name>-repo` | `react-hook-form-documentation-repo` |
  | server.name | `<lib>-docs-mcp` | matches package name |
  | searchToolName | `search_<lib_snake>_docs` | `search_react_hook_form_docs` |
  | resourceUriScheme | `<lib>-docs` | `react-hook-form-docs` |
  | pathExample | a REAL doc path | `docs/useform` |
- `docUrl.base` + a doc path must equal the live URL. Recheck against the browser.
- Document your feasibility findings in the preset's header comment (see reactNativeDocs.ts for the style).

## 3. Package scaffold: `packages/<lib>-docs-mcp/`

Copy `packages/react-hook-form-docs-mcp/` wholesale, then swap:

- **package.json**: name, description, keywords, `repository`/`homepage` (point at the future standalone mirror repo `Sannnao/<lib>-docs-mcp`; `bugs` stays on the monorepo), version `0.1.0`. Keep: tsup build script, the hand-mirrored dependency list (must match root deps — bump together), `files` incl. LICENSE.
- **src/index.ts**: import the new preset; keep the `--version`/`-v` fast-exit (postinstall/UX depends on it). Only add `--docs-version` handling if step 1 found versioned docs.
- **README.md**: swap branding, tool names, examples, Limitations. **Absolute URLs only** — relative links/images break on npm and in the mirror repo. Poster: `https://raw.githubusercontent.com/Sannnao/react-docs-mcp/master/poster.png`.
- **LICENSE**: copy from repo root.
- **`.claude/skills/using-<lib>-docs-mcp/SKILL.md`**: adapt from the RHF one — directory listings (LobeHub) scan for a skill file.

`npm install` inside the package dir (it has its own lockfile).

## 3b. Cross-link ALL package READMEs — easy to forget, always required

Every package in the family links every other one. Adding a package means touching **every existing README**, not just the new one:

- **Root `README.md`**: add the new package to the "Also available — same engine, other docs" callout block under the title (npm link + standalone repo link + one-phrase description).
- **Every `packages/*/README.md`**: each has an "Also available — same engine, other docs:" line near the top listing all *sibling* packages (npm links). Add the new package to each of them.
- **New package's README**: its sibling line lists all the *other* packages.

Checklist: after this step, `grep -L "<new-package-name>" README.md packages/*/README.md` must print **nothing** — every README mentions the new package (siblings via cross-links, the new one via its own install commands). Any path it prints is a README you forgot.

## 4. Tests + CI

- Add the preset to the loop in `src/__tests__/presets.test.ts` AND to the identity-collision checks (cacheDirName/scheme/tool/server.name must differ across ALL presets pairwise).
- Add the package dir to the build matrix in `.github/workflows/test.yml`.
- `npm run build && npm test` at root must be green.

## 5. Smoke test — required before publish

Build the package, then drive it over JSON-RPC (see scratchpad pattern used for RN):
initialize → tools/list (names/enums correct) → `search_<lib>_docs` (results have live-site URLs) → `get_doc` for a nested AND a root-level path → `list_sections` → a bogus `section` (must return the validation error listing valid sections). **curl/open 2-3 returned URLs and confirm they resolve to the right pages** — this is what catches slug mismatches.

## 6. Ship

1. Commit + push (CI must go green).
2. `cd packages/<lib>-docs-mcp && npm publish` (user runs it — needs OTP).
3. Standalone mirror (needed for MCP directories like LobeHub that reject subfolder URLs): user creates empty `Sannnao/<lib>-docs-mcp` repo → first sync manually: `git subtree split --prefix=packages/<lib>-docs-mcp -b tmp && git push --force git@github.com:Sannnao/<lib>-docs-mcp.git tmp:master && git branch -D tmp` → add a sync workflow (copy `.github/workflows/sync-mirror.yml`, change paths + repo) → user extends the `MIRROR_TOKEN` fine-grained PAT to include the new repo. Disable Issues on the mirror.
4. Directory submissions: LobeHub (mirror URL), PulseMCP, Glama, mcpservers.org, `modelcontextprotocol/servers` list PR.
