import { describe, it, expect } from 'vitest';
import { reactDocsPreset } from '../presets/reactDocs.js';
import { resolveReactNativeDocsPreset, LATEST_VERSION } from '../presets/reactNativeDocs.js';

const reactNativeDocsPreset = resolveReactNativeDocsPreset();

describe('presets', () => {
  for (const [name, preset] of [
    ['reactDocsPreset', reactDocsPreset],
    ['reactNativeDocsPreset', reactNativeDocsPreset],
  ] as const) {
    describe(name, () => {
      it('has required fields populated', () => {
        expect(preset.cacheDirName).toBeTruthy();
        expect(preset.repoFolderName).toBeTruthy();
        expect(preset.repo.url).toMatch(/^https:\/\/github\.com\//);
        expect(preset.repo.contentPath).toBeTruthy();
        expect(preset.server.name).toBeTruthy();
        expect(preset.server.version).toBeTruthy();
        expect(preset.sections.length).toBeGreaterThan(0);
        expect(preset.resourceUriScheme).toBeTruthy();
        expect(preset.docsLabel).toBeTruthy();
        expect(preset.searchToolName).toMatch(/^search_/);
        expect(preset.searchToolDescription).toBeTruthy();
        expect(preset.pathExample).toBeTruthy();
        expect(preset.docUrl.base).toMatch(/^https:\/\//);
      });
    });
  }

  it('presets do not share identity-sensitive values', () => {
    expect(reactDocsPreset.cacheDirName).not.toBe(reactNativeDocsPreset.cacheDirName);
    expect(reactDocsPreset.repoFolderName).not.toBe(reactNativeDocsPreset.repoFolderName);
    expect(reactDocsPreset.resourceUriScheme).not.toBe(reactNativeDocsPreset.resourceUriScheme);
    expect(reactDocsPreset.searchToolName).not.toBe(reactNativeDocsPreset.searchToolName);
    expect(reactDocsPreset.server.name).not.toBe(reactNativeDocsPreset.server.name);
  });

  describe('resolveReactNativeDocsPreset versions', () => {
    it('defaults to the always-current docs folder', () => {
      const preset = resolveReactNativeDocsPreset();

      expect(preset.repo.contentPath).toBe('docs');
      expect(preset.docUrl.base).toBe('https://reactnative.dev/docs');
    });

    it('points a pinned version at its versioned_docs snapshot', () => {
      const preset = resolveReactNativeDocsPreset('0.77');

      expect(preset.repo.contentPath).toBe('website/versioned_docs/version-0.77');
      expect(preset.docUrl.base).toBe('https://reactnative.dev/docs/0.77');
    });

    it('uses frontmatter-id slugs for all versions, not just latest', () => {
      expect(resolveReactNativeDocsPreset().docUrl.useFrontmatterId).toBe(true);
      expect(resolveReactNativeDocsPreset('0.77').docUrl.useFrontmatterId).toBe(true);
    });

    it('rejects malformed version strings with a helpful error', () => {
      expect(() => resolveReactNativeDocsPreset('v0.77')).toThrow(/Invalid React Native docs version/);
      expect(() => resolveReactNativeDocsPreset('75')).toThrow(/Invalid React Native docs version/);
      expect(() => resolveReactNativeDocsPreset('banana')).toThrow(/Invalid React Native docs version/);
      expect(() => resolveReactNativeDocsPreset('')).toThrow(/Invalid React Native docs version/);
    });

    it('accepts well-formed versions and the latest sentinel', () => {
      expect(() => resolveReactNativeDocsPreset('0.77')).not.toThrow();
      expect(() => resolveReactNativeDocsPreset('1.0')).not.toThrow();
      expect(() => resolveReactNativeDocsPreset(LATEST_VERSION)).not.toThrow();
    });
  });
});
