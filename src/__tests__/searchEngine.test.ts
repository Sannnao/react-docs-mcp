import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchEngine } from '../searchEngine.js';
import { configure, type DocsMcpPreset } from '../config.js';
import { reactDocsPreset } from '../presets/reactDocs.js';
import type { ParsedDoc } from '../types.js';

// Mock dependencies
vi.mock('../docsManager.js');
// Partial mock: parseMarkdown is stubbed per-test, but normalizePath stays real
// because searchEngine.getDocByPath depends on its actual behavior
vi.mock('../markdownParser.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../markdownParser.js')>();
  return { ...actual, parseMarkdown: vi.fn() };
});
vi.mock('../embeddingService.js');

describe('SearchEngine', () => {
  let searchEngine: SearchEngine;
  let mockDocsManager: any;
  let mockEmbeddingService: any;
  let mockParseMarkdown: any;

  const createMockDoc = (path: string, title: string, plainText: string): ParsedDoc => ({
    path,
    section: path.split('/')[0],
    metadata: { title, description: `Description for ${title}` },
    content: `# ${title}\n\n${plainText}`,
    plainText,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock DocsManager
    const { DocsManager } = await import('../docsManager.js');
    mockDocsManager = {
      getAllDocs: vi.fn(),
      readDoc: vi.fn(),
    };
    (DocsManager as any).mockImplementation(() => mockDocsManager);

    // Mock parseMarkdown
    const markdownParser = await import('../markdownParser.js');
    mockParseMarkdown = vi.fn();
    (markdownParser.parseMarkdown as any) = mockParseMarkdown;

    // Mock EmbeddingService
    const { EmbeddingService } = await import('../embeddingService.js');
    mockEmbeddingService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      generateEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.5)),
      cosineSimilarity: vi.fn().mockReturnValue(0.8),
    };
    (EmbeddingService as any).mockImplementation(() => mockEmbeddingService);

    searchEngine = new SearchEngine(mockDocsManager);
  });

  describe('indexDocuments', () => {
    it('should index all documents from docsManager', async () => {
      mockDocsManager.getAllDocs.mockResolvedValue(['learn/intro.md', 'reference/api.md']);
      mockDocsManager.readDoc.mockResolvedValueOnce('content1').mockResolvedValueOnce('content2');
      mockParseMarkdown
        .mockResolvedValueOnce(createMockDoc('learn/intro', 'Intro', 'intro text'))
        .mockResolvedValueOnce(createMockDoc('reference/api', 'API', 'api text'));

      await searchEngine.indexDocuments();

      expect(mockDocsManager.getAllDocs).toHaveBeenCalled();
      expect(mockDocsManager.readDoc).toHaveBeenCalledTimes(2);
      expect(mockParseMarkdown).toHaveBeenCalledTimes(2);
    });

    it('should clear existing index before indexing', async () => {
      mockDocsManager.getAllDocs.mockResolvedValue(['doc1.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown.mockResolvedValue(createMockDoc('learn/doc1', 'Doc1', 'text'));

      // Index twice
      await searchEngine.indexDocuments();
      await searchEngine.indexDocuments();

      // Should have been called twice (not accumulated)
      expect(mockParseMarkdown).toHaveBeenCalledTimes(2);
    });

    it('should continue indexing if single document fails', async () => {
      mockDocsManager.getAllDocs.mockResolvedValue(['doc1.md', 'doc2.md']);
      mockDocsManager.readDoc
        .mockRejectedValueOnce(new Error('Read error'))
        .mockResolvedValueOnce('content2');
      mockParseMarkdown.mockResolvedValue(createMockDoc('learn/doc2', 'Doc2', 'text'));

      await searchEngine.indexDocuments();

      // Should still index doc2
      expect(mockParseMarkdown).toHaveBeenCalledTimes(1);
    });

    it('should regenerate embeddings after re-indexing so semantic search keeps working (update_docs flow)', async () => {
      mockDocsManager.getAllDocs.mockResolvedValue(['doc1.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown.mockImplementation(async () =>
        createMockDoc('learn/doc1', 'Doc1', 'searchable text')
      );

      // First semantic search generates embeddings
      const firstResults = await searchEngine.search('searchable');
      expect(firstResults.length).toBeGreaterThan(0);
      const embeddingCallsAfterFirstSearch =
        mockEmbeddingService.generateEmbedding.mock.calls.length;

      // update_docs flow: repo changed, documents re-indexed (fresh ParsedDocs, no embeddings)
      await searchEngine.indexDocuments();

      // Semantic search must still return results, which requires regenerating embeddings
      const secondResults = await searchEngine.search('searchable');
      expect(secondResults.length).toBeGreaterThan(0);
      expect(mockEmbeddingService.generateEmbedding.mock.calls.length).toBeGreaterThan(
        embeddingCallsAfterFirstSearch
      );
    });
  });

  describe('generateEmbeddings', () => {
    beforeEach(async () => {
      // Setup indexed documents
      mockDocsManager.getAllDocs.mockResolvedValue(['doc1.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown.mockResolvedValue(createMockDoc('learn/doc1', 'Doc1', 'plain text here'));
      await searchEngine.indexDocuments();
    });

    it('should initialize embedding service', async () => {
      await searchEngine.generateEmbeddings();

      expect(mockEmbeddingService.initialize).toHaveBeenCalled();
    });

    it('should generate embeddings for all indexed documents', async () => {
      await searchEngine.generateEmbeddings();

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        expect.stringContaining('Doc1')
      );
    });

    it('should use title + description + first 1000 chars for embedding', async () => {
      const longText = 'x'.repeat(2000);
      mockDocsManager.getAllDocs.mockResolvedValue(['doc.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown.mockResolvedValue(createMockDoc('learn/doc', 'Title', longText));
      await searchEngine.indexDocuments();

      await searchEngine.generateEmbeddings();

      const call = mockEmbeddingService.generateEmbedding.mock.calls[0][0];
      expect(call).toContain('Title');
      expect(call).toContain('Description for Title');
      expect(call.length).toBeLessThan(2000); // Should be truncated
    });

    it('should skip if embeddings already generated', async () => {
      await searchEngine.generateEmbeddings();
      vi.clearAllMocks();

      await searchEngine.generateEmbeddings();

      expect(mockEmbeddingService.initialize).not.toHaveBeenCalled();
    });

    it('should throw error if embedding generation fails', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValueOnce(new Error('Model error'));

      await expect(searchEngine.generateEmbeddings()).rejects.toThrow('Model error');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      mockDocsManager.getAllDocs.mockResolvedValue(['doc1.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown.mockResolvedValue(
        createMockDoc('learn/hooks', 'useState Hook', 'This is about state management')
      );
    });

    it('should auto-index if not indexed', async () => {
      await searchEngine.search('state');

      expect(mockDocsManager.getAllDocs).toHaveBeenCalled();
    });

    it('should return empty array for empty query', async () => {
      const results = await searchEngine.search('');

      expect(results).toEqual([]);
    });

    it('should return empty array for whitespace query', async () => {
      const results = await searchEngine.search('   ');

      expect(results).toEqual([]);
    });

    it('should use keyword search when semantic search disabled', async () => {
      await searchEngine.indexDocuments();
      const results = await searchEngine.search('state', { useSemanticSearch: false });

      expect(results).toHaveLength(1);
      expect(results[0].doc.metadata.title).toBe('useState Hook');
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('should use semantic search by default', async () => {
      await searchEngine.indexDocuments();
      mockEmbeddingService.cosineSimilarity.mockReturnValue(0.9);

      await searchEngine.search('state');

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
    });
  });

  describe('keywordSearch', () => {
    beforeEach(async () => {
      mockDocsManager.getAllDocs.mockResolvedValue([
        'doc1.md',
        'doc2.md',
        'doc3.md',
      ]);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown
        .mockResolvedValueOnce(createMockDoc('learn/hooks', 'useState Hook', 'state management'))
        .mockResolvedValueOnce(createMockDoc('learn/intro', 'Introduction', 'getting started'))
        .mockResolvedValueOnce(createMockDoc('reference/api', 'API Reference', 'state API docs'));

      await searchEngine.indexDocuments();
    });

    it('should find documents matching query terms', async () => {
      const results = await searchEngine.search('state', { useSemanticSearch: false });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].doc.plainText).toContain('state');
    });

    it('should score title matches higher', async () => {
      const results = await searchEngine.search('useState', { useSemanticSearch: false });

      // Doc with "useState" in title should rank first
      expect(results[0].doc.metadata.title).toContain('useState');
    });

    it('should filter by section when provided', async () => {
      const results = await searchEngine.search('state', {
        useSemanticSearch: false,
        section: 'reference',
      });

      expect(results).toHaveLength(1);
      expect(results[0].doc.section).toBe('reference');
    });

    it('should limit results to specified limit', async () => {
      const results = await searchEngine.search('state', {
        useSemanticSearch: false,
        limit: 1,
      });

      expect(results).toHaveLength(1);
    });

    it('should not exceed maxLimit', async () => {
      const results = await searchEngine.search('state', {
        useSemanticSearch: false,
        limit: 1000, // Try to exceed max
      });

      expect(results.length).toBeLessThanOrEqual(50); // CONFIG.search.maxLimit
    });

    it('should filter by minScore', async () => {
      const results = await searchEngine.search('state', {
        useSemanticSearch: false,
        minScore: 100, // Very high threshold
      });

      // Should filter out low-scoring results
      results.forEach(r => expect(r.score).toBeGreaterThanOrEqual(100));
    });

    it('should generate snippets for results', async () => {
      const results = await searchEngine.search('state', { useSemanticSearch: false });

      expect(results[0].snippet).toBeDefined();
      expect(typeof results[0].snippet).toBe('string');
    });

    it('should sort results by score descending', async () => {
      const results = await searchEngine.search('state', { useSemanticSearch: false });

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });
  });

  describe('semanticSearch', () => {
    beforeEach(async () => {
      mockDocsManager.getAllDocs.mockResolvedValue(['doc1.md', 'doc2.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown
        .mockResolvedValueOnce(createMockDoc('learn/hooks', 'Hooks', 'state text'))
        .mockResolvedValueOnce(createMockDoc('learn/intro', 'Intro', 'other text'));

      await searchEngine.indexDocuments();
    });

    it('should auto-generate embeddings if not generated', async () => {
      await searchEngine.search('state');

      expect(mockEmbeddingService.initialize).toHaveBeenCalled();
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
    });

    it('should calculate hybrid score (keyword + semantic)', async () => {
      mockEmbeddingService.cosineSimilarity.mockReturnValue(0.9);

      const results = await searchEngine.search('state');

      // Should have results with hybrid scoring
      expect(results.length).toBeGreaterThan(0);
      expect(mockEmbeddingService.cosineSimilarity).toHaveBeenCalled();
    });

    it('should filter by semanticMinSimilarity threshold', async () => {
      mockEmbeddingService.cosineSimilarity.mockReturnValue(0.1); // Below threshold (0.3)

      const results = await searchEngine.search('unrelated');

      expect(results).toHaveLength(0);
    });

    it('should filter by section', async () => {
      mockEmbeddingService.cosineSimilarity.mockReturnValue(0.9);

      const results = await searchEngine.search('state', { section: 'learn' });

      results.forEach(r => expect(r.doc.section).toBe('learn'));
    });
  });

  describe('getDocByPath', () => {
    beforeEach(async () => {
      mockDocsManager.getAllDocs.mockResolvedValue(['learn/hooks.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown.mockResolvedValue(createMockDoc('learn/hooks', 'Hooks', 'text'));
      await searchEngine.indexDocuments();
    });

    it('should return document by exact path', async () => {
      const doc = await searchEngine.getDocByPath('learn/hooks');

      expect(doc).not.toBeNull();
      expect(doc?.metadata.title).toBe('Hooks');
    });

    it('should normalize path by removing .md extension', async () => {
      const doc = await searchEngine.getDocByPath('learn/hooks.md');

      expect(doc).not.toBeNull();
      expect(doc?.metadata.title).toBe('Hooks');
    });

    it('should return null for non-existent path', async () => {
      const doc = await searchEngine.getDocByPath('nonexistent');

      expect(doc).toBeNull();
    });

    it('should auto-index if not indexed', async () => {
      const newEngine = new SearchEngine(mockDocsManager);

      await newEngine.getDocByPath('learn/hooks');

      expect(mockDocsManager.getAllDocs).toHaveBeenCalled();
    });

    it('should normalize leading slashes', async () => {
      const doc = await searchEngine.getDocByPath('/learn/hooks');

      expect(doc?.metadata.title).toBe('Hooks');
    });

    it('should normalize Windows-style backslashes', async () => {
      const doc = await searchEngine.getDocByPath('learn\\hooks');

      expect(doc?.metadata.title).toBe('Hooks');
    });

    it('should normalize .mdx extension', async () => {
      const doc = await searchEngine.getDocByPath('learn/hooks.mdx');

      expect(doc?.metadata.title).toBe('Hooks');
    });
  });

  describe('frontmatter id slugs (useFrontmatterId presets)', () => {
    const idPreset: DocsMcpPreset = {
      ...reactDocsPreset,
      docUrl: { base: 'https://example.dev/docs', useFrontmatterId: true },
    };

    afterEach(() => {
      configure(reactDocsPreset);
    });

    it('indexes docs under their frontmatter-id slug so emitted URLs round-trip', async () => {
      configure(idPreset);
      // Real react-native-website case: introduction.md has id getting-started,
      // getting-started.md has id environment-setup
      const intro = createMockDoc('introduction', 'Introduction', 'intro text');
      intro.metadata.id = 'getting-started';
      const envSetup = createMockDoc('getting-started', 'Environment Setup', 'setup text');
      envSetup.metadata.id = 'environment-setup';

      mockDocsManager.getAllDocs.mockResolvedValue(['introduction.md', 'getting-started.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown.mockResolvedValueOnce(intro).mockResolvedValueOnce(envSetup);

      await searchEngine.indexDocuments();

      // The URL slug for introduction.md is getting-started — get_doc must return THAT doc
      const byUrlSlug = await searchEngine.getDocByPath('getting-started');
      expect(byUrlSlug?.metadata.title).toBe('Introduction');

      const byIdSlug = await searchEngine.getDocByPath('environment-setup');
      expect(byIdSlug?.metadata.title).toBe('Environment Setup');
    });

    it('replaces only the last path segment with the id', async () => {
      configure(idPreset);
      const doc = createMockDoc('the-new-architecture/what-is-codegen', 'Codegen', 'text');
      doc.metadata.id = 'codegen-intro';

      mockDocsManager.getAllDocs.mockResolvedValue(['the-new-architecture/what-is-codegen.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown.mockResolvedValue(doc);

      await searchEngine.indexDocuments();

      const found = await searchEngine.getDocByPath('the-new-architecture/codegen-intro');
      expect(found?.metadata.title).toBe('Codegen');
    });

    it('ignores non-string frontmatter ids instead of crashing', async () => {
      configure(idPreset);
      const doc = createMockDoc('some-page', 'Some Page', 'text');
      doc.metadata.id = 123 as unknown as string;

      mockDocsManager.getAllDocs.mockResolvedValue(['some-page.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown.mockResolvedValue(doc);

      await searchEngine.indexDocuments();

      const found = await searchEngine.getDocByPath('some-page');
      expect(found?.metadata.title).toBe('Some Page');
    });

    it('leaves paths untouched when useFrontmatterId is false', async () => {
      // default react.dev preset: ids must NOT rewrite paths
      const doc = createMockDoc('index', 'Home', 'text');
      doc.metadata.id = 'home';

      mockDocsManager.getAllDocs.mockResolvedValue(['index.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown.mockResolvedValue(doc);

      await searchEngine.indexDocuments();

      const found = await searchEngine.getDocByPath('index');
      expect(found?.metadata.title).toBe('Home');
      expect(await searchEngine.getDocByPath('home')).toBeNull();
    });
  });

  describe('getDocsBySection', () => {
    beforeEach(async () => {
      mockDocsManager.getAllDocs.mockResolvedValue(['learn/doc1.md', 'reference/doc2.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown
        .mockResolvedValueOnce(createMockDoc('learn/doc1', 'Doc1', 'text'))
        .mockResolvedValueOnce(createMockDoc('reference/doc2', 'Doc2', 'text'));
      await searchEngine.indexDocuments();
    });

    it('should return documents from specified section', async () => {
      const docs = await searchEngine.getDocsBySection('learn');

      expect(docs).toHaveLength(1);
      expect(docs[0].section).toBe('learn');
    });

    it('should be case insensitive', async () => {
      const docs = await searchEngine.getDocsBySection('LEARN');

      expect(docs).toHaveLength(1);
    });

    it('should return empty array for non-existent section', async () => {
      const docs = await searchEngine.getDocsBySection('nonexistent');

      expect(docs).toEqual([]);
    });

    it('should auto-index if not indexed', async () => {
      const newEngine = new SearchEngine(mockDocsManager);

      await newEngine.getDocsBySection('learn');

      expect(mockDocsManager.getAllDocs).toHaveBeenCalled();
    });
  });

  describe('generateSnippet', () => {
    it('should extract context around matched term', async () => {
      const longText = 'a'.repeat(100) + 'target word' + 'b'.repeat(100);
      mockDocsManager.getAllDocs.mockResolvedValue(['doc.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown.mockResolvedValue(createMockDoc('learn/doc', 'Title', longText));
      await searchEngine.indexDocuments();

      const results = await searchEngine.search('target', { useSemanticSearch: false });

      expect(results[0].snippet).toContain('target');
      expect(results[0].snippet).toContain('...');
    });

    it('should use description if no match found', async () => {
      mockDocsManager.getAllDocs.mockResolvedValue(['doc.md']);
      mockDocsManager.readDoc.mockResolvedValue('content');
      mockParseMarkdown.mockResolvedValue(createMockDoc('learn/doc', 'Title', 'some text'));
      await searchEngine.indexDocuments();

      const results = await searchEngine.search('nomatch', {
        useSemanticSearch: false,
        minScore: 0,
      });

      // Should still have a snippet (description or truncated text)
      if (results.length > 0) {
        expect(results[0].snippet).toBeDefined();
      }
    });
  });
});
