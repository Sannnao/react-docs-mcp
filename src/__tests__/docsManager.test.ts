import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocsManager } from '../docsManager.js';

// Mock modules
vi.mock('simple-git');
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
  },
}));
vi.mock('fast-glob');

describe('DocsManager', () => {
  let manager: DocsManager;
  let mockGit: any;
  let mockFs: any;
  let mockFg: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock git operations
    mockGit = {
      clone: vi.fn().mockResolvedValue(undefined),
      log: vi.fn().mockResolvedValue({
        latest: {
          hash: 'abc123',
          date: '2024-01-01',
        },
      }),
      revparse: vi.fn().mockResolvedValue('abc123'),
      pull: vi.fn().mockResolvedValue(undefined),
    };

    const { simpleGit } = await import('simple-git');
    (simpleGit as any).mockReturnValue(mockGit);

    // Mock fs operations
    const fs = await import('fs');
    mockFs = fs.promises;

    // Mock fast-glob
    mockFg = (await import('fast-glob')).default;

    manager = new DocsManager();
  });

  describe('initialize', () => {
    it('should skip clone if repo exists', async () => {
      // Mock repo exists
      (mockFs.access as any).mockResolvedValue(undefined);

      await manager.initialize();

      expect(mockGit.clone).not.toHaveBeenCalled();
    });

    it('should clone repo if it does not exist', async () => {
      // Mock repo doesn't exist
      (mockFs.access as any).mockRejectedValueOnce(new Error('ENOENT'));

      await manager.initialize();

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://github.com/reactjs/react.dev.git',
        expect.stringContaining('react-dev-repo'),
        { '--depth': 1 }
      );
    });

    it('should throw error if clone fails', async () => {
      (mockFs.access as any).mockRejectedValueOnce(new Error('ENOENT'));
      mockGit.clone.mockRejectedValueOnce(new Error('Network error'));

      await expect(manager.initialize()).rejects.toThrow('Failed to clone repository');
    });
  });

  describe('getStatus', () => {
    it('should return isCloned=false if repo does not exist', async () => {
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));

      const status = await manager.getStatus();

      expect(status.isCloned).toBe(false);
      expect(status.currentCommit).toBeUndefined();
    });

    it('should return status with commit info if repo exists', async () => {
      (mockFs.access as any).mockResolvedValue(undefined);

      const status = await manager.getStatus();

      expect(status.isCloned).toBe(true);
      expect(status.currentCommit).toBe('abc123');
      expect(status.lastUpdated).toBeInstanceOf(Date);
    });

    it('should return isCloned=true but no details if git log fails', async () => {
      (mockFs.access as any).mockResolvedValue(undefined);
      mockGit.log.mockRejectedValueOnce(new Error('Git error'));

      const status = await manager.getStatus();

      expect(status.isCloned).toBe(true);
      expect(status.currentCommit).toBeUndefined();
    });
  });

  describe('updateRepo', () => {
    it('should throw error if repo not cloned', async () => {
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));

      await expect(manager.updateRepo()).rejects.toThrow('Repository not cloned');
    });

    it('should return true and clear cache when updates pulled', async () => {
      (mockFs.access as any).mockResolvedValue(undefined);
      mockGit.revparse
        .mockResolvedValueOnce('abc123')  // before
        .mockResolvedValueOnce('def456'); // after (different)

      // Populate cache first
      (mockFg as any).mockResolvedValue(['file1.md', 'file2.md']);
      await manager.getAllDocs();

      const hasUpdates = await manager.updateRepo();

      expect(hasUpdates).toBe(true);
      expect(mockGit.pull).toHaveBeenCalled();

      // Cache should be cleared - next call should hit fs again
      vi.clearAllMocks();
      (mockFg as any).mockResolvedValue(['file3.md']);
      const docs = await manager.getAllDocs();
      expect(mockFg).toHaveBeenCalled(); // Cache was cleared
    });

    it('should return false and preserve cache when no updates', async () => {
      (mockFs.access as any).mockResolvedValue(undefined);
      mockGit.revparse
        .mockResolvedValueOnce('abc123')  // before
        .mockResolvedValueOnce('abc123'); // after (same)

      const hasUpdates = await manager.updateRepo();

      expect(hasUpdates).toBe(false);
      expect(mockGit.pull).toHaveBeenCalled();
    });

    it('should throw error if pull fails', async () => {
      (mockFs.access as any).mockResolvedValue(undefined);
      mockGit.pull.mockRejectedValueOnce(new Error('Merge conflict'));

      await expect(manager.updateRepo()).rejects.toThrow('Failed to update repository');
    });
  });

  describe('getDocsInSection', () => {
    it('should return cached results on second call', async () => {
      (mockFs.access as any).mockResolvedValue(undefined);
      (mockFg as any).mockResolvedValue(['hooks/useState.md', 'hooks/useEffect.md']);

      const first = await manager.getDocsInSection('learn');
      const second = await manager.getDocsInSection('learn');

      expect(first).toEqual(['learn/hooks/useState.md', 'learn/hooks/useEffect.md']);
      expect(second).toEqual(first);
      expect(mockFg).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should return empty array for non-existent section', async () => {
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));

      const result = await manager.getDocsInSection('nonexistent');

      expect(result).toEqual([]);
      expect(mockFg).not.toHaveBeenCalled();
    });

    it('should prepend section name to file paths', async () => {
      (mockFs.access as any).mockResolvedValue(undefined);
      (mockFg as any).mockResolvedValue(['file1.md', 'subdir/file2.md']);

      const result = await manager.getDocsInSection('reference');

      expect(result).toEqual(['reference/file1.md', 'reference/subdir/file2.md']);
    });
  });

  describe('getAllDocs', () => {
    it('should return cached results on second call', async () => {
      (mockFg as any).mockResolvedValue(['learn/doc1.md', 'reference/doc2.md']);

      const first = await manager.getAllDocs();
      const second = await manager.getAllDocs();

      expect(first).toEqual(['learn/doc1.md', 'reference/doc2.md']);
      expect(second).toEqual(first);
      expect(mockFg).toHaveBeenCalledTimes(1);
    });

    it('should find all markdown files recursively', async () => {
      (mockFg as any).mockResolvedValue([
        'learn/getting-started.md',
        'learn/hooks/useState.md',
        'reference/react/Component.md',
      ]);

      const result = await manager.getAllDocs();

      expect(result).toHaveLength(3);
      expect(mockFg).toHaveBeenCalledWith('**/*.md', expect.objectContaining({
        absolute: false,
      }));
    });
  });

  describe('readDoc', () => {
    it('should read file content', async () => {
      (mockFs.readFile as any).mockResolvedValue('# Title\n\nContent here');

      const content = await manager.readDoc('learn/intro.md');

      expect(content).toBe('# Title\n\nContent here');
      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('learn/intro.md'),
        'utf-8'
      );
    });

    it('should throw error for non-existent file', async () => {
      (mockFs.readFile as any).mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(manager.readDoc('missing.md')).rejects.toThrow('Failed to read document');
    });
  });

  describe('docExists', () => {
    it('should return true for existing file', async () => {
      (mockFs.access as any).mockResolvedValue(undefined);

      const exists = await manager.docExists('learn/intro.md');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));

      const exists = await manager.docExists('missing.md');

      expect(exists).toBe(false);
    });
  });
});
