/**
 * Type definitions for git-utils module
 */

/**
 * Cache for memoizing git merge-base operations
 */
export class MergeBaseCache {
  constructor();

  /**
   * Get cached merge-base result
   */
  getMergeBase(repoPath: string, oid1: string, oid2: string): string | null;

  /**
   * Set merge-base result in cache
   */
  setMergeBase(repoPath: string, oid1: string, oid2: string, mergeBase: string): void;

  /**
   * Get cached parents for a commit
   */
  getParents(repoPath: string, oid: string): Set<string> | null;

  /**
   * Set parents for a commit in cache
   */
  setParents(repoPath: string, oid: string, parents: string[]): void;

  /**
   * Get cached commit object
   */
  getCommit(repoPath: string, oid: string): any | null;

  /**
   * Set commit object in cache
   */
  setCommit(repoPath: string, oid: string, commit: any): void;

  /**
   * Get cached generation number
   */
  getGeneration(repoPath: string, oid: string): number | null;

  /**
   * Set generation number in cache
   */
  setGeneration(repoPath: string, oid: string, generation: number): void;

  /**
   * Clear all caches for a specific repository
   */
  clearRepo(repoPath: string): void;

  /**
   * Clear all caches
   */
  clearAll(): void;

  /**
   * Get cache statistics
   */
  getStats(repoPath: string): {
    mergeBaseEntries: number;
    ancestryEntries: number;
    commitEntries: number;
    generationEntries: number;
  };
}

/**
 * Global cache instance
 */
export const globalCache: MergeBaseCache;

/**
 * Find merge-base (common ancestor) between two commits using memoized BFS
 *
 * @param dir - Repository directory path
 * @param oid1 - First commit OID (can be a branch name, tag, or full/short OID)
 * @param oid2 - Second commit OID (can be a branch name, tag, or full/short OID)
 * @param cache - Cache instance (defaults to global cache)
 * @returns OID of the merge-base commit
 *
 * @example
 * ```typescript
 * const mergeBase = await findMergeBase('/path/to/repo', 'main', 'feature-branch');
 * console.log(`Merge base: ${mergeBase}`);
 * ```
 */
export function findMergeBase(
  dir: string,
  oid1: string,
  oid2: string,
  cache?: MergeBaseCache
): Promise<string>;

/**
 * Find merge-base between multiple commits (octopus merge)
 *
 * @param dir - Repository directory path
 * @param oids - Array of commit OIDs
 * @param cache - Cache instance (defaults to global cache)
 * @returns OID of the common merge-base
 *
 * @example
 * ```typescript
 * const mergeBase = await findMergeBaseMultiple(
 *   '/path/to/repo',
 *   ['main', 'feature-1', 'feature-2']
 * );
 * ```
 */
export function findMergeBaseMultiple(
  dir: string,
  oids: string[],
  cache?: MergeBaseCache
): Promise<string>;

/**
 * Check if one commit is an ancestor of another
 *
 * @param dir - Repository directory path
 * @param ancestorOid - Potential ancestor commit OID
 * @param descendantOid - Potential descendant commit OID
 * @param cache - Cache instance (defaults to global cache)
 * @returns True if ancestorOid is an ancestor of descendantOid
 *
 * @example
 * ```typescript
 * const isMainAncestor = await isAncestor(
 *   '/path/to/repo',
 *   'main',
 *   'feature-branch'
 * );
 * if (isMainAncestor) {
 *   console.log('feature-branch is ahead of main');
 * }
 * ```
 */
export function isAncestor(
  dir: string,
  ancestorOid: string,
  descendantOid: string,
  cache?: MergeBaseCache
): Promise<boolean>;

/**
 * Get all common ancestors between two commits
 *
 * @param dir - Repository directory path
 * @param oid1 - First commit OID
 * @param oid2 - Second commit OID
 * @param cache - Cache instance (defaults to global cache)
 * @returns Array of common ancestor OIDs
 *
 * @example
 * ```typescript
 * const ancestors = await findAllCommonAncestors(
 *   '/path/to/repo',
 *   'main',
 *   'feature-branch'
 * );
 * console.log(`Found ${ancestors.length} common ancestors`);
 * ```
 */
export function findAllCommonAncestors(
  dir: string,
  oid1: string,
  oid2: string,
  cache?: MergeBaseCache
): Promise<string[]>;

/**
 * Create a new cache instance for isolated caching
 *
 * @returns New cache instance
 *
 * @example
 * ```typescript
 * const cache = createCache();
 * const mergeBase = await findMergeBase('/path/to/repo', 'main', 'feature', cache);
 * console.log(cache.getStats('/path/to/repo'));
 * ```
 */
export function createCache(): MergeBaseCache;

/**
 * Alias for findMergeBase
 */
export const mergeBase: typeof findMergeBase;
