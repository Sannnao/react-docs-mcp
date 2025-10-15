import { describe, it, expect } from 'vitest';
import { summarizeContent, extractStructure } from '../summarizer.js';

describe('summarizer', () => {
  describe('summarizeContent', () => {
    it('should return content as-is when under maxLength', () => {
      const content = 'This is a short paragraph.';
      const result = summarizeContent(content, 1000);

      expect(result).toBe('This is a short paragraph.');
    });

    it('should remove code blocks from content', () => {
      const content = `Introduction paragraph.

\`\`\`js
const code = 'example';
\`\`\`

Conclusion paragraph.`;

      const result = summarizeContent(content);

      expect(result).not.toContain('```');
      expect(result).not.toContain('const code');
      expect(result).toContain('Introduction paragraph');
      expect(result).toContain('Conclusion paragraph');
    });

    it('should remove frontmatter', () => {
      const content = `---
title: My Doc
---

Content here.`;

      const result = summarizeContent(content);

      expect(result).not.toContain('---');
      expect(result).not.toContain('title:');
      expect(result).toContain('Content here');
    });

    it('should include first 3 meaningful paragraphs', () => {
      const content = `Para 1

Para 2

Para 3

Para 4`;

      const result = summarizeContent(content, 1000);

      expect(result).toContain('Para 1');
      expect(result).toContain('Para 2');
      expect(result).toContain('Para 3');
      // Should stop at 3
    });

    it('should truncate at maxLength with ellipsis', () => {
      const longPara = 'x'.repeat(200);
      const result = summarizeContent(longPara, 50);

      expect(result).toHaveLength(53); // 50 + '...'
      expect(result).toMatch(/\.\.\.$/);
    });

    it('should filter out headings from paragraphs', () => {
      const content = `# Heading

Content paragraph.

## Another Heading

More content.`;

      const result = summarizeContent(content);

      // Headings should not appear as paragraphs in body
      expect(result).toContain('Content paragraph');
      expect(result).toContain('More content');
    });

    it('should add heading structure when space available', () => {
      const content = `# Main

Content.

## Sub

More.`;

      const result = summarizeContent(content, 1000);

      expect(result).toContain('**Content structure:**');
      expect(result).toContain('Main');
      expect(result).toContain('Sub');
    });

    it('should not add heading structure if result is > 70% of maxLength', () => {
      const longContent = 'a'.repeat(800);
      const result = summarizeContent(`# Title\n\n${longContent}`, 1000);

      // 800 chars > 700 (70% of 1000), so no structure
      expect(result).not.toContain('**Content structure:**');
    });

    it('should handle empty content', () => {
      expect(summarizeContent('')).toBe('');
    });

    it('should preserve paragraph spacing with double newlines', () => {
      const content = `First.

Second.`;

      const result = summarizeContent(content, 1000);

      // Should have double newline between paragraphs
      expect(result).toContain('First.\n\nSecond.');
    });
  });

  describe('extractStructure', () => {
    it('should extract heading with first meaningful line after it', () => {
      const content = `# Title

First line after title.

Second line.`;

      const result = extractStructure(content);

      expect(result).toContain('**Title**');
      expect(result).toContain('First line after title.');
      expect(result).not.toContain('Second line');
    });

    it('should only extract h1-h3 headings', () => {
      const content = `# H1

Text 1.

## H2

Text 2.

### H3

Text 3.

#### H4

Text 4.`;

      const result = extractStructure(content);

      expect(result).toContain('**H1**');
      expect(result).toContain('**H2**');
      expect(result).toContain('**H3**');
      expect(result).not.toContain('**H4**'); // Should skip h4
    });

    it('should truncate first lines to 100 chars', () => {
      const longLine = 'a'.repeat(200);
      const content = `# Heading\n\n${longLine}`;

      const result = extractStructure(content);
      const lines = result.split('\n').filter(l => l.startsWith('a'));

      expect(lines[0]).toHaveLength(100);
    });

    it('should skip HTML lines', () => {
      const content = `# Heading

<div>HTML content that makes this longer than 20 chars</div>

Real content here that is long enough.`;

      const result = extractStructure(content);

      expect(result).not.toContain('<div>');
      expect(result).toContain('Real content here');
    });

    it('should skip markdown link lines', () => {
      const content = `# Heading

[Link text with more content](url) to make it longer

Real content here that is long enough.`;

      const result = extractStructure(content);

      expect(result).not.toContain('[Link');
      expect(result).toContain('Real content here');
    });

    it('should strip markdown formatting from captured lines', () => {
      const content = `# Heading

This is **bold** and *italic* text with more content.`;

      const result = extractStructure(content);

      // Note: ** is used for the heading itself (**Heading**), but should be stripped from content
      const lines = result.split('\n');
      const contentLine = lines.find(l => l.includes('bold'));

      expect(contentLine).toBeDefined();
      expect(contentLine).toContain('bold');
      expect(contentLine).toContain('italic');
      // Content line shouldn't have markdown asterisks (already stripped)
      expect(contentLine).not.toMatch(/\*\*bold\*\*/);
      expect(contentLine).not.toMatch(/\*italic\*/);
    });

    it('should only capture lines longer than 20 chars', () => {
      const content = `# Heading

Short.

This is a longer line that should be captured.`;

      const result = extractStructure(content);

      expect(result).not.toContain('Short.');
      expect(result).toContain('This is a longer line');
    });

    it('should return empty string for content with no headings', () => {
      const content = 'Just plain text.';

      expect(extractStructure(content)).toBe('');
    });

    it('should handle empty content', () => {
      expect(extractStructure('')).toBe('');
    });
  });
});
