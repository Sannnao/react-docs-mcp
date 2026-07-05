/**
 * searchDefaults.ts
 * Shared search tuning used by all presets — single source of truth so a
 * ranking change can't silently apply to one published server but not the other.
 * (Type-only import from config.js keeps this module free of runtime cycles.)
 */

import type { SearchConfig } from '../config.js';

export const DEFAULT_SEARCH: SearchConfig = {
  defaultLimit: 10,
  maxLimit: 50,
  minScore: 0.1,
  semanticSearchEnabled: true,
  semanticMinSimilarity: 0.3,
  hybridKeywordWeight: 0.3,
  hybridSemanticWeight: 0.7,
};
