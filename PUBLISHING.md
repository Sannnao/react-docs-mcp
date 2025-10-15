# Publishing to npm

## Prerequisites

1. **npm account**: Sign up at https://www.npmjs.com/signup
2. **Login locally**:
   ```bash
   npm login
   ```

## Pre-publish Checklist

- [ ] Update version in `package.json`
- [ ] Update `README.md` if needed
- [ ] Run `npm run build` to ensure it compiles
- [ ] Test locally with `npm pack --dry-run`
- [ ] Update repository URL in `package.json` (change from `yourusername` to actual username)

## Publishing Steps

### 1. Build the Project

```bash
npm run build
```

### 2. Test the Package Locally

```bash
# Create tarball
npm pack

# Test installation locally
npm install -g ./react-docs-mcp-1.0.0.tgz

# Test it works
npx react-docs-mcp

# Clean up
npm uninstall -g react-docs-mcp
rm react-docs-mcp-1.0.0.tgz
```

### 3. Publish to npm

```bash
# For first publish
npm publish

# For updates (bump version first)
npm version patch  # 1.0.0 -> 1.0.1
npm publish

# Or for minor version
npm version minor  # 1.0.0 -> 1.1.0
npm publish

# Or for major version
npm version major  # 1.0.0 -> 2.0.0
npm publish
```

### 4. Verify Publication

```bash
# Check npm page
npm view react-docs-mcp

# Test installation
npx react-docs-mcp@latest
```

## Post-publish

1. **Update GitHub**: Push version tag
   ```bash
   git push --tags
   ```

2. **Create GitHub Release**: Go to GitHub releases and create a new release from the tag

3. **Share**: Tweet, post on Reddit, etc.

## Usage After Publishing

Users can now install with:

```bash
# Claude Code
claude mcp add --transport stdio react-docs -- npx react-docs-mcp

# Or Claude Desktop config.json
{
  "mcpServers": {
    "react-docs": {
      "command": "npx",
      "args": ["-y", "react-docs-mcp"]
    }
  }
}
```

## Versioning Guidelines

- **Patch (1.0.x)**: Bug fixes, documentation updates
- **Minor (1.x.0)**: New features, non-breaking changes
- **Major (x.0.0)**: Breaking changes

## Troubleshooting

### Package name already taken
- Choose a different name in `package.json`
- Try: `@yourusername/react-docs-mcp`

### Build fails
- Ensure all TypeScript compiles: `npm run build`
- Check for missing dependencies

### npm publish fails
- Ensure you're logged in: `npm whoami`
- Check package.json is valid: `npm publish --dry-run`

## Package Stats

After publishing, monitor at:
- npm page: https://www.npmjs.com/package/react-docs-mcp
- Downloads: https://npm-stat.com/charts.html?package=react-docs-mcp

## Updating After Publish

1. Make changes
2. Bump version: `npm version patch|minor|major`
3. Build: `npm run build`
4. Publish: `npm publish`
5. Push git tags: `git push --tags`
