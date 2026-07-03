import { describe, it, expect } from 'vitest';
import { reactDocsPreset } from '../presets/reactDocs.js';
import { reactNativeDocsPreset } from '../presets/reactNativeDocs.js';

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
});
