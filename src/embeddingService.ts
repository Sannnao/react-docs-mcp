/**
 * embeddingService.ts
 * Generate embeddings using transformers.js for semantic search
 */

import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js
env.allowLocalModels = true;
env.allowRemoteModels = true;

/**
 * Embedding service using all-MiniLM-L6-v2 model
 * This is a lightweight model (23MB) optimized for semantic similarity
 */
export class EmbeddingService {
  private pipeline: any = null;
  private initialized: boolean = false;
  private modelName: string = 'Xenova/all-MiniLM-L6-v2';

  /**
   * Initialize the embedding pipeline
   * Downloads model on first run (~23MB)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('Initializing embedding model (first run may take a moment)...');

    try {
      this.pipeline = await pipeline('feature-extraction', this.modelName);
      this.initialized = true;
      console.log('Embedding model initialized successfully');
    } catch (error) {
      console.error('Failed to initialize embedding model:', error);
      throw new Error(`Embedding initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate embedding for a text
   * @param text - Text to embed
   * @returns Vector embedding (384 dimensions for all-MiniLM-L6-v2)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Truncate text to reasonable length (512 tokens max)
      const truncated = text.slice(0, 2000);

      const output = await this.pipeline(truncated, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert tensor to array
      const embedding = Array.from(output.data) as number[];
      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   * @param texts - Array of texts to embed
   * @returns Array of vector embeddings
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param a - First vector
   * @param b - Second vector
   * @returns Similarity score (0-1, higher is more similar)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Find most similar vectors to a query vector
   * @param queryEmbedding - Query vector
   * @param docEmbeddings - Array of document vectors with metadata
   * @param topK - Number of results to return
   * @returns Array of {index, similarity} sorted by similarity desc
   */
  findMostSimilar(
    queryEmbedding: number[],
    docEmbeddings: Array<{ embedding: number[]; index: number }>,
    topK: number
  ): Array<{ index: number; similarity: number }> {
    const similarities = docEmbeddings.map(({ embedding, index }) => ({
      index,
      similarity: this.cosineSimilarity(queryEmbedding, embedding),
    }));

    // Sort by similarity descending
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, topK);
  }
}
