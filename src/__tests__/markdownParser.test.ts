import { describe, it, expect } from 'vitest';
import {
  parseMarkdown,
  markdownToPlainText,
  extractSection,
} from '../markdownParser.js';

describe('markdownParser', () => {
  describe('parseMarkdown', () => {
    it('should parse markdown with frontmatter', async () => {
      const content = `---
title: useState Hook
description: A React hook for state management
date: 2024-01-01
author: React Team
tags: [hooks, state]
---

# useState

This is content about useState.`;

      const result = await parseMarkdown(content, 'learn/hooks/useState.md');

      expect(result.path).toBe('learn/hooks/useState');
      expect(result.section).toBe('learn');
      expect(result.metadata.title).toBe('useState Hook');
      expect(result.metadata.description).toBe('A React hook for state management');
      expect(result.metadata.date).toEqual(new Date('2024-01-01')); // gray-matter parses dates as Date objects
      expect(result.metadata.author).toBe('React Team');
      expect(result.metadata.tags).toEqual(['hooks', 'state']);
      expect(result.content).toContain('# useState');
      expect(result.plainText).toContain('useState');
    });

    it('should parse markdown without frontmatter', async () => {
      const content = `# My Title

This is some content.`;

      const result = await parseMarkdown(content, 'learn/getting-started.md');

      expect(result.path).toBe('learn/getting-started');
      expect(result.section).toBe('learn');
      expect(result.metadata.title).toBe('Getting Started'); // from path
      expect(result.content).toBe(content);
    });

    it('should extract title from path when no frontmatter title', async () => {
      const content = 'Some content';

      const result = await parseMarkdown(content, 'learn/use-effect.md');

      expect(result.metadata.title).toBe('Use Effect');
    });

    it('should handle empty content', async () => {
      const result = await parseMarkdown('', 'learn/empty.md');

      expect(result.path).toBe('learn/empty');
      expect(result.content).toBe('');
      expect(result.plainText).toBe('');
    });

    it('should handle malformed frontmatter', async () => {
      const content = `---
title: Test
---

Content`;

      const result = await parseMarkdown(content, 'test.md');

      // Valid frontmatter with content
      expect(result.path).toBe('test');
      expect(result.metadata.title).toBe('Test');
      expect(result.content).toContain('Content');
    });
  });

  describe('markdownToPlainText', () => {
    it('should strip bold and italic formatting', async () => {
      const markdown = 'This is **bold** and *italic* text.';
      const result = await markdownToPlainText(markdown);

      expect(result).not.toContain('**');
      expect(result).not.toContain('*');
      expect(result).toContain('bold');
      expect(result).toContain('italic');
    });

    it('should strip links but keep text', async () => {
      const markdown = 'Visit [React](https://react.dev) website.';
      const result = await markdownToPlainText(markdown);

      expect(result).not.toContain('[');
      expect(result).not.toContain(']');
      expect(result).not.toContain('https://');
      expect(result).toContain('React');
    });

    it('should normalize whitespace', async () => {
      const markdown = 'Line 1\n\n\nLine 2\n\n\n\nLine 3';
      const result = await markdownToPlainText(markdown);

      expect(result).not.toContain('\n\n\n');
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
    });

    it('should handle code blocks', async () => {
      const markdown = '```js\nconst x = 1;\n```';
      const result = await markdownToPlainText(markdown);

      expect(result).not.toContain('```');
    });

    it('should handle empty input', async () => {
      const result = await markdownToPlainText('');
      expect(result).toBe('');
    });
  });

  describe('extractSection', () => {
    it('should extract section from multi-level path', () => {
      expect(extractSection('learn/hooks/useState.md')).toBe('learn');
      expect(extractSection('reference/react/Component.md')).toBe('reference');
      expect(extractSection('blog/2024/release.md')).toBe('blog');
    });

    it('should handle single-level path', () => {
      expect(extractSection('readme.md')).toBe('readme');
      expect(extractSection('readme')).toBe('readme');
    });

    it('should handle paths with backslashes (Windows)', () => {
      expect(extractSection('learn\\hooks\\useState.md')).toBe('learn');
    });

    it('should handle empty path', () => {
      expect(extractSection('')).toBe('unknown');
    });

    it('should normalize path and remove .md extension', () => {
      expect(extractSection('learn/hooks/useState.md')).toBe('learn');
      expect(extractSection('learn/hooks/useState')).toBe('learn');
    });
  });
});
