/**
 * summarizer.ts
 * Extract concise summaries from markdown content
 */

/**
 * Extract a concise summary from markdown content
 * @param content - Full markdown content
 * @param maxLength - Maximum summary length in characters
 * @returns Concise summary
 */
export function summarizeContent(content: string, maxLength: number = 1500): string {
  // Remove code blocks (can be very long)
  let summary = content.replace(/```[\s\S]*?```/g, '[code example]');

  // Remove frontmatter if present
  summary = summary.replace(/^---[\s\S]*?---\n/, '');

  // Extract first few meaningful paragraphs
  const paragraphs = summary
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 20 && !p.startsWith('#'));

  // Take first few paragraphs up to maxLength
  let result = '';
  let headings: string[] = [];

  // Extract headings for structure
  const headingMatches = content.match(/^#{1,3}\s+(.+)$/gm);
  if (headingMatches) {
    headings = headingMatches.slice(0, 5).map(h => h.replace(/^#+\s*/, '- '));
  }

  // Build summary
  for (const para of paragraphs.slice(0, 3)) {
    if (result.length + para.length > maxLength) {
      break;
    }
    result += para + '\n\n';
  }

  // Add structure if we have headings
  if (headings.length > 0 && result.length < maxLength * 0.7) {
    result += '\n**Content structure:**\n' + headings.join('\n');
  }

  // Truncate if still too long
  if (result.length > maxLength) {
    result = result.slice(0, maxLength) + '...';
  }

  return result.trim();
}

/**
 * Extract key sections from markdown (headings + first line of each section)
 * @param content - Full markdown content
 * @returns Structured overview
 */
export function extractStructure(content: string): string {
  const lines = content.split('\n');
  const structure: string[] = [];
  let currentHeading = '';
  let capturedFirstLine = false;

  for (const line of lines) {
    // Match headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      currentHeading = headingMatch[2];
      structure.push(`\n**${currentHeading}**`);
      capturedFirstLine = false;
      continue;
    }

    // Capture first meaningful line after heading
    if (currentHeading && !capturedFirstLine && line.trim().length > 20) {
      const cleaned = line.replace(/[*_`]/g, '').trim();
      if (!cleaned.startsWith('<') && !cleaned.startsWith('[')) {
        structure.push(cleaned.slice(0, 100));
        capturedFirstLine = true;
      }
    }
  }

  return structure.join('\n');
}
