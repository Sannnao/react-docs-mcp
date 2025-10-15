/**
 * docsManager.ts
 * Handle Git repository operations and file system access
 */

import { simpleGit, SimpleGit } from 'simple-git';
import { promises as fs } from 'fs';
import path from 'path';
import fg from 'fast-glob';
import CONFIG from './config.js';
import type { RepoStatus } from './types.js';

export class DocsManager {
  private git: SimpleGit;
  private repoPath: string;
  private contentPath: string;
  private fileCache: Map<string, string[]> = new Map();

  constructor() {
    this.repoPath = path.resolve(CONFIG.repo.localPath);
    this.contentPath = path.join(this.repoPath, CONFIG.repo.contentPath);
    this.git = simpleGit();
  }

  /**
   * Initialize the docs manager
   * Checks if repo exists, clones if needed
   */
  async initialize(): Promise<void> {
    const repoExists = await this.checkRepoExists();

    if (!repoExists) {
      console.log('Cloning React documentation repository...');
      await this.cloneRepo();
      console.log('Repository cloned successfully');
    } else {
      console.log('Repository already exists');
    }
  }

  /**
   * Check if repository exists locally
   */
  private async checkRepoExists(): Promise<boolean> {
    try {
      await fs.access(path.join(this.repoPath, '.git'));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clone the repository
   */
  private async cloneRepo(): Promise<void> {
    try {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(this.repoPath), { recursive: true });

      await this.git.clone(CONFIG.repo.url, this.repoPath, {
        '--depth': 1, // Shallow clone for faster download
      });
    } catch (error) {
      throw new Error(
        `Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<RepoStatus> {
    const isCloned = await this.checkRepoExists();

    if (!isCloned) {
      return { isCloned: false };
    }

    try {
      const git = simpleGit(this.repoPath);
      const log = await git.log({ maxCount: 1 });

      return {
        isCloned: true,
        currentCommit: log.latest?.hash,
        lastUpdated: log.latest?.date ? new Date(log.latest.date) : undefined,
      };
    } catch (error) {
      console.error('Failed to get repo status:', error);
      return { isCloned: true };
    }
  }

  /**
   * Update repository (git pull)
   * Returns true if updates were pulled
   */
  async updateRepo(): Promise<boolean> {
    const isCloned = await this.checkRepoExists();

    if (!isCloned) {
      throw new Error('Repository not cloned. Call initialize() first.');
    }

    try {
      const git = simpleGit(this.repoPath);
      const beforeHash = await git.revparse(['HEAD']);

      await git.pull();

      const afterHash = await git.revparse(['HEAD']);
      const hasUpdates = beforeHash !== afterHash;

      if (hasUpdates) {
        // Clear file cache when repo is updated
        this.fileCache.clear();
        console.log('Repository updated successfully');
      } else {
        console.log('Repository already up to date');
      }

      return hasUpdates;
    } catch (error) {
      throw new Error(
        `Failed to update repository: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get all markdown files from a section
   * @param section - Section name (learn, reference, etc.)
   * @returns Array of file paths relative to content root
   */
  async getDocsInSection(section: string): Promise<string[]> {
    const cacheKey = `section:${section}`;

    if (this.fileCache.has(cacheKey)) {
      return this.fileCache.get(cacheKey)!;
    }

    const sectionPath = path.join(this.contentPath, section);

    try {
      await fs.access(sectionPath);
    } catch {
      // Section doesn't exist
      return [];
    }

    const files = await fg('**/*.md', {
      cwd: sectionPath,
      absolute: false,
    });

    // Convert to paths relative to content root
    const relativePaths = files.map(file => `${section}/${file}`);

    this.fileCache.set(cacheKey, relativePaths);
    return relativePaths;
  }

  /**
   * Get all markdown files across all sections
   * @returns Array of file paths relative to content root
   */
  async getAllDocs(): Promise<string[]> {
    const cacheKey = 'all';

    if (this.fileCache.has(cacheKey)) {
      return this.fileCache.get(cacheKey)!;
    }

    const files = await fg('**/*.md', {
      cwd: this.contentPath,
      absolute: false,
    });

    this.fileCache.set(cacheKey, files);
    return files;
  }

  /**
   * Read file content
   * @param relativePath - Path relative to content root
   * @returns Raw file content
   */
  async readDoc(relativePath: string): Promise<string> {
    const fullPath = path.join(this.contentPath, relativePath);

    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to read document at ${relativePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if file exists
   * @param relativePath - Path relative to content root
   */
  async docExists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.contentPath, relativePath);

    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
