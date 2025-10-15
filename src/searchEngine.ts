/**
 * searchEngine.ts
 * Implement search functionality over documentation
 */

import { DocsManager } from './docsManager.js';
import { parseMarkdown } from './markdownParser.js';
import { EmbeddingService } from './embeddingService.js';
import CONFIG from './config.js';
import type { ParsedDoc, SearchOptions, SearchResult } from './types.js';

export class SearchEngine {
  private docsManager: DocsManager;
  private embeddingService: EmbeddingService;
  private documentIndex: Map<string, ParsedDoc> = new Map();
  private indexed: boolean = false;
  private embeddingsGenerated: boolean = false;

  /**
   * Initialize search engine
   * @param docsManager - Instance of DocsManager
   */
  constructor(docsManager: DocsManager) {
    this.docsManager = docsManager;
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Index all documents for searching
   * Should be called after repo update
   */
  async indexDocuments(): Promise<void> {
    console.log('Indexing documents...');
    this.documentIndex.clear();

    const allDocs = await this.docsManager.getAllDocs();

    for (const docPath of allDocs) {
      try {
        const content = await this.docsManager.readDoc(docPath);
        const parsedDoc = await parseMarkdown(content, docPath);
        this.documentIndex.set(parsedDoc.path, parsedDoc);
      } catch (error) {
        console.warn(`Failed to index document ${docPath}:`, error);
      }
    }

    this.indexed = true;
    console.log(`Indexed ${this.documentIndex.size} documents`);
  }

  /**
   * Generate embeddings for all documents
   * Called lazily when semantic search is first used
   */
  async generateEmbeddings(): Promise<void> {
    if (this.embeddingsGenerated) return;

    console.log('Generating embeddings for documents (first run may take 1-2 minutes)...');

    try {
      await this.embeddingService.initialize();

      let count = 0;
      for (const doc of this.documentIndex.values()) {
        // Create embedding text from title + description + first 1000 chars
        const embeddingText = `${doc.metadata.title}. ${doc.metadata.description || ''}. ${doc.plainText.slice(0, 1000)}`;
        const embedding = await this.embeddingService.generateEmbedding(embeddingText);
        doc.embedding = embedding;
        count++;

        if (count % 10 === 0) {
          console.log(`Generated embeddings for ${count}/${this.documentIndex.size} documents...`);
        }
      }

      this.embeddingsGenerated = true;
      console.log(`Embeddings generated for all ${this.documentIndex.size} documents`);
    } catch (error) {
      console.error('Failed to generate embeddings:', error);
      throw error;
    }
  }

  /**
   * Search documents
   * @param query - Search query string
   * @param options - Search options (section filter, limit, etc.)
   * @returns Ranked search results
   */
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    // Ensure documents are indexed
    if (!this.indexed) {
      await this.indexDocuments();
    }

    // Handle empty query
    if (!query.trim()) {
      return [];
    }

    const useSemanticSearch = options?.useSemanticSearch ?? CONFIG.search.semanticSearchEnabled;

    // Use semantic or hybrid search if enabled
    if (useSemanticSearch) {
      return await this.semanticSearch(query, options);
    }

    // Fall back to keyword search
    return await this.keywordSearch(query, options);
  }

  /**
   * Keyword-based search
   */
  private async keywordSearch(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const limit = Math.min(
      options?.limit || CONFIG.search.defaultLimit,
      CONFIG.search.maxLimit
    );
    const minScore = options?.minScore ?? CONFIG.search.minScore;
    const sectionFilter = options?.section?.toLowerCase();

    // Normalize query
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

    const results: SearchResult[] = [];

    // Score each document
    for (const doc of this.documentIndex.values()) {
      // Apply section filter
      if (sectionFilter && doc.section.toLowerCase() !== sectionFilter) {
        continue;
      }

      const score = this.scoreDocument(doc, queryTerms);

      if (score >= minScore) {
        const snippet = this.generateSnippet(doc, queryTerms);
        results.push({ doc, score, snippet });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return top results
    return results.slice(0, limit);
  }

  /**
   * Semantic search using embeddings (hybrid with keyword search)
   */
  private async semanticSearch(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    // Ensure embeddings are generated
    if (!this.embeddingsGenerated) {
      await this.generateEmbeddings();
    }

    const limit = Math.min(
      options?.limit || CONFIG.search.defaultLimit,
      CONFIG.search.maxLimit
    );
    const sectionFilter = options?.section?.toLowerCase();

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Get all docs with embeddings, filtered by section
    const docs = Array.from(this.documentIndex.values()).filter(doc => {
      if (sectionFilter && doc.section.toLowerCase() !== sectionFilter) {
        return false;
      }
      return doc.embedding !== undefined;
    });

    // Calculate hybrid scores (keyword + semantic)
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results: SearchResult[] = [];

    for (const doc of docs) {
      // Keyword score (normalized to 0-1)
      const keywordScore = this.scoreDocument(doc, queryTerms) / 100;

      // Semantic similarity score (0-1)
      const semanticScore = this.embeddingService.cosineSimilarity(
        queryEmbedding,
        doc.embedding!
      );

      // Hybrid score (weighted combination)
      const hybridScore =
        CONFIG.search.hybridKeywordWeight * keywordScore +
        CONFIG.search.hybridSemanticWeight * semanticScore;

      if (semanticScore >= CONFIG.search.semanticMinSimilarity) {
        const snippet = this.generateSnippet(doc, queryTerms);
        results.push({ doc, score: hybridScore, snippet });
      }
    }

    // Sort by hybrid score descending
    results.sort((a, b) => b.score - a.score);

    // Return top results
    return results.slice(0, limit);
  }

  /**
   * Score a document based on query terms
   */
  private scoreDocument(doc: ParsedDoc, queryTerms: string[]): number {
    let score = 0;

    const titleLower = doc.metadata.title.toLowerCase();
    const plainTextLower = doc.plainText.toLowerCase();
    const pathLower = doc.path.toLowerCase();

    for (const term of queryTerms) {
      // Title match (high weight)
      if (titleLower.includes(term)) {
        score += 10;
      }

      // Path match (medium weight)
      if (pathLower.includes(term)) {
        score += 5;
      }

      // Count occurrences in plain text
      const regex = new RegExp(term, 'gi');
      const matches = plainTextLower.match(regex);
      if (matches) {
        score += matches.length * 0.5;
      }

      // Description match (medium weight)
      if (doc.metadata.description?.toLowerCase().includes(term)) {
        score += 3;
      }
    }

    return score;
  }

  /**
   * Generate context snippet showing matched text
   */
  private generateSnippet(doc: ParsedDoc, queryTerms: string[]): string {
    const plainText = doc.plainText;

    // Find first occurrence of any query term
    let firstMatchIndex = -1;
    let matchedTerm = '';

    for (const term of queryTerms) {
      const index = plainText.toLowerCase().indexOf(term);
      if (index !== -1 && (firstMatchIndex === -1 || index < firstMatchIndex)) {
        firstMatchIndex = index;
        matchedTerm = term;
      }
    }

    if (firstMatchIndex === -1) {
      // No match in content, use description or first 150 chars
      return doc.metadata.description || plainText.slice(0, 150) + '...';
    }

    // Extract context around match (±75 chars)
    const contextRadius = 75;
    const start = Math.max(0, firstMatchIndex - contextRadius);
    const end = Math.min(plainText.length, firstMatchIndex + matchedTerm.length + contextRadius);

    let snippet = plainText.slice(start, end);

    // Add ellipsis if truncated
    if (start > 0) snippet = '...' + snippet;
    if (end < plainText.length) snippet = snippet + '...';

    return snippet.trim();
  }

  /**
   * Get document by exact path
   * @param path - Document path relative to content root
   * @returns Parsed document or null if not found
   */
  async getDocByPath(path: string): Promise<ParsedDoc | null> {
    // Ensure documents are indexed
    if (!this.indexed) {
      await this.indexDocuments();
    }

    // Normalize path (remove .md if present)
    const normalizedPath = path.replace(/\.md$/, '');

    return this.documentIndex.get(normalizedPath) || null;
  }

  /**
   * List all available sections
   */
  getSections(): string[] {
    return [...CONFIG.sections];
  }

  /**
   * Get all documents in a section
   */
  async getDocsBySection(section: string): Promise<ParsedDoc[]> {
    // Ensure documents are indexed
    if (!this.indexed) {
      await this.indexDocuments();
    }

    const sectionLower = section.toLowerCase();
    const docs: ParsedDoc[] = [];

    for (const doc of this.documentIndex.values()) {
      if (doc.section.toLowerCase() === sectionLower) {
        docs.push(doc);
      }
    }

    return docs;
  }
}
