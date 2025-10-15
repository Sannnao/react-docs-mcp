/**
 * markdownParser.ts
 * Parse markdown files and extract metadata and content
 */

import matter from 'gray-matter';
import { remark } from 'remark';
import stripMarkdown from 'strip-markdown';
import type { DocMetadata, ParsedDoc } from './types.js';

/**
 * Parse a markdown file
 * @param content - Raw markdown content
 * @param path - File path for context
 * @returns Parsed document with metadata and content
 */
export async function parseMarkdown(
  content: string,
  path: string
): Promise<ParsedDoc> {
  // Parse frontmatter
  const { data, content: markdownContent } = matter(content);

  // Extract metadata
  const metadata: DocMetadata = {
    title: data.title || extractTitleFromPath(path),
    description: data.description,
    date: data.date,
    author: data.author,
    tags: data.tags,
    ...data,
  };

  // Convert to plain text for search
  const plainText = await markdownToPlainText(markdownContent);

  // Extract section from path
  const section = extractSection(path);

  return {
    path: normalizePath(path),
    section,
    metadata,
    content: markdownContent,
    plainText,
  };
}

/**
 * Strip markdown formatting to plain text
 * Used for search indexing
 * @param markdown - Markdown content
 * @returns Plain text
 */
export async function markdownToPlainText(markdown: string): Promise<string> {
  const result = await remark()
    .use(stripMarkdown)
    .process(markdown);

  return String(result)
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract section from file path
 * E.g., "learn/hooks/useState.md" -> "learn"
 */
export function extractSection(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split('/');
  return parts[0] || 'unknown';
}

/**
 * Normalize path (forward slashes, no leading slash, no .md extension for display)
 */
function normalizePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/') // Convert backslashes to forward slashes
    .replace(/^\/+/, '') // Remove leading slashes
    .replace(/\.md$/, ''); // Remove .md extension for cleaner paths
}

/**
 * Extract title from path if not in frontmatter
 * E.g., "learn/hooks/useState" -> "useState"
 */
function extractTitleFromPath(filePath: string): string {
  const normalized = normalizePath(filePath);
  const parts = normalized.split('/');
  const filename = parts[parts.length - 1] || 'Untitled';

  // Convert kebab-case or snake_case to Title Case
  return filename
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
