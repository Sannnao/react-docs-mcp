import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService } from '../embeddingService.js';

// Mock @xenova/transformers
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(),
  env: {
    allowLocalModels: true,
    allowRemoteModels: true,
  },
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockPipeline: any;

  beforeEach(async () => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create mock pipeline function
    mockPipeline = vi.fn().mockResolvedValue({
      data: new Float32Array(384).fill(0.5), // Mock 384-dim embedding
    });

    // Mock the pipeline factory
    const { pipeline } = await import('@xenova/transformers');
    (pipeline as any).mockResolvedValue(mockPipeline);

    service = new EmbeddingService();
  });

  describe('initialize', () => {
    it('should initialize pipeline successfully', async () => {
      await service.initialize();

      const { pipeline } = await import('@xenova/transformers');
      expect(pipeline).toHaveBeenCalledWith('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    });

    it('should set initialized flag to true', async () => {
      await service.initialize();

      // Test by calling generateEmbedding - shouldn't call pipeline again
      const { pipeline } = await import('@xenova/transformers');
      vi.clearAllMocks();

      await service.generateEmbedding('test');

      expect(pipeline).not.toHaveBeenCalled(); // Already initialized
    });

    it('should skip initialization if already initialized', async () => {
      await service.initialize();

      const { pipeline } = await import('@xenova/transformers');
      vi.clearAllMocks();

      await service.initialize(); // Call again

      expect(pipeline).not.toHaveBeenCalled();
    });

    it('should throw error on pipeline failure', async () => {
      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockRejectedValueOnce(new Error('Model download failed'));

      await expect(service.initialize()).rejects.toThrow('Embedding initialization failed');
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for text', async () => {
      const result = await service.generateEmbedding('test text');

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(384);
      expect(result[0]).toBe(0.5);
    });

    it('should truncate text to 2000 chars', async () => {
      const longText = 'a'.repeat(3000);
      await service.generateEmbedding(longText);

      expect(mockPipeline).toHaveBeenCalledWith(
        'a'.repeat(2000),
        { pooling: 'mean', normalize: true }
      );
    });

    it('should use mean pooling and normalization', async () => {
      await service.generateEmbedding('test');

      expect(mockPipeline).toHaveBeenCalledWith(
        'test',
        { pooling: 'mean', normalize: true }
      );
    });

    it('should auto-initialize if not initialized', async () => {
      const { pipeline } = await import('@xenova/transformers');

      await service.generateEmbedding('test');

      expect(pipeline).toHaveBeenCalled();
    });

    it('should throw error on generation failure', async () => {
      mockPipeline.mockRejectedValueOnce(new Error('GPU memory error'));

      await expect(service.generateEmbedding('test')).rejects.toThrow('Embedding generation failed');
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const result = await service.generateEmbeddings(texts);

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(384);
      expect(result[1]).toHaveLength(384);
      expect(result[2]).toHaveLength(384);
    });

    it('should handle empty array', async () => {
      const result = await service.generateEmbeddings([]);

      expect(result).toEqual([]);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3, 4];
      const result = service.cosineSimilarity(vec, vec);

      expect(result).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const result = service.cosineSimilarity(vec1, vec2);

      expect(result).toBe(0);
    });

    it('should return -1 for opposite vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [-1, -2, -3];
      const result = service.cosineSimilarity(vec1, vec2);

      expect(result).toBeCloseTo(-1, 5);
    });

    it('should throw error for mismatched vector lengths', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];

      expect(() => service.cosineSimilarity(vec1, vec2)).toThrow('Vectors must have same length');
    });

    it('should return 0 for zero magnitude vectors', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [1, 2, 3];
      const result = service.cosineSimilarity(vec1, vec2);

      expect(result).toBe(0);
    });
  });

  describe('findMostSimilar', () => {
    it('should return top K most similar results', () => {
      const queryEmbedding = [1, 0, 0];
      const docEmbeddings = [
        { embedding: [1, 0, 0], index: 0 },     // similarity = 1
        { embedding: [0.8, 0.6, 0], index: 1 }, // similarity = 0.8
        { embedding: [0, 1, 0], index: 2 },     // similarity = 0
        { embedding: [0.6, 0.8, 0], index: 3 }, // similarity = 0.6
      ];

      const result = service.findMostSimilar(queryEmbedding, docEmbeddings, 2);

      expect(result).toHaveLength(2);
      expect(result[0].index).toBe(0);
      expect(result[0].similarity).toBeCloseTo(1, 5);
      expect(result[1].index).toBe(1);
      expect(result[1].similarity).toBeCloseTo(0.8, 5);
    });

    it('should sort by similarity descending', () => {
      const queryEmbedding = [1, 0, 0];
      const docEmbeddings = [
        { embedding: [0, 1, 0], index: 0 },     // similarity = 0
        { embedding: [1, 0, 0], index: 1 },     // similarity = 1
        { embedding: [0.5, 0.5, 0], index: 2 }, // similarity = ~0.7
      ];

      const result = service.findMostSimilar(queryEmbedding, docEmbeddings, 3);

      expect(result[0].index).toBe(1); // highest
      expect(result[1].index).toBe(2); // middle
      expect(result[2].index).toBe(0); // lowest
    });

    it('should handle topK greater than array length', () => {
      const queryEmbedding = [1, 0, 0];
      const docEmbeddings = [
        { embedding: [1, 0, 0], index: 0 },
      ];

      const result = service.findMostSimilar(queryEmbedding, docEmbeddings, 10);

      expect(result).toHaveLength(1);
    });

    it('should handle empty docEmbeddings array', () => {
      const queryEmbedding = [1, 0, 0];
      const result = service.findMostSimilar(queryEmbedding, [], 5);

      expect(result).toEqual([]);
    });
  });
});
