/**
 * Low-level git merge-base implementation using isomorphic-git
 *
 * This module implements a memoized BFS (Breadth-First Search) algorithm
 * to find the merge base (common ancestor) between two commits.
 *
 * The memoization strategy is optimized for multiple calls with the same
 * repository, caching:
 * 1. Commit ancestry chains
 * 2. Merge-base results between commit pairs
 * 3. Commit metadata to reduce git object reads
 */

const git = require('isomorphic-git');
const fs = require('fs');

/**
 * MergeBaseCache - Manages memoization for merge-base operations
 */
class MergeBaseCache {
  constructor() {
    // Cache for merge-base results: Map<string, Map<string, string>>
    // Structure: repoPath -> (commit1_commit2 -> mergeBase)
    this.mergeBaseCache = new Map();

    // Cache for commit ancestry: Map<string, Map<string, Set<string>>>
    // Structure: repoPath -> (commitOid -> Set of parent OIDs)
    this.ancestryCache = new Map();

    // Cache for commit objects: Map<string, Map<string, Object>>
    // Structure: repoPath -> (commitOid -> commit object)
    this.commitCache = new Map();

    // Cache for generation numbers (distance from root): Map<string, Map<string, number>>
    // Structure: repoPath -> (commitOid -> generation)
    this.generationCache = new Map();
  }

  /**
   * Get a cache key for two commits (order-independent)
   */
  getMergeBaseKey(oid1, oid2) {
    return oid1 < oid2 ? `${oid1}_${oid2}` : `${oid2}_${oid1}`;
  }

  /**
   * Get cached merge-base result
   */
  getMergeBase(repoPath, oid1, oid2) {
    const repoCache = this.mergeBaseCache.get(repoPath);
    if (!repoCache) return null;
    return repoCache.get(this.getMergeBaseKey(oid1, oid2)) || null;
  }

  /**
   * Set merge-base result in cache
   */
  setMergeBase(repoPath, oid1, oid2, mergeBase) {
    if (!this.mergeBaseCache.has(repoPath)) {
      this.mergeBaseCache.set(repoPath, new Map());
    }
    this.mergeBaseCache.get(repoPath).set(
      this.getMergeBaseKey(oid1, oid2),
      mergeBase
    );
  }

  /**
   * Get cached parents for a commit
   */
  getParents(repoPath, oid) {
    const repoCache = this.ancestryCache.get(repoPath);
    if (!repoCache) return null;
    return repoCache.get(oid) || null;
  }

  /**
   * Set parents for a commit in cache
   */
  setParents(repoPath, oid, parents) {
    if (!this.ancestryCache.has(repoPath)) {
      this.ancestryCache.set(repoPath, new Map());
    }
    this.ancestryCache.get(repoPath).set(oid, new Set(parents));
  }

  /**
   * Get cached commit object
   */
  getCommit(repoPath, oid) {
    const repoCache = this.commitCache.get(repoPath);
    if (!repoCache) return null;
    return repoCache.get(oid) || null;
  }

  /**
   * Set commit object in cache
   */
  setCommit(repoPath, oid, commit) {
    if (!this.commitCache.has(repoPath)) {
      this.commitCache.set(repoPath, new Map());
    }
    this.commitCache.get(repoPath).set(oid, commit);
  }

  /**
   * Get cached generation number
   */
  getGeneration(repoPath, oid) {
    const repoCache = this.generationCache.get(repoPath);
    if (!repoCache) return null;
    const gen = repoCache.get(oid);
    return gen !== undefined ? gen : null;
  }

  /**
   * Set generation number in cache
   */
  setGeneration(repoPath, oid, generation) {
    if (!this.generationCache.has(repoPath)) {
      this.generationCache.set(repoPath, new Map());
    }
    this.generationCache.get(repoPath).set(oid, generation);
  }

  /**
   * Clear all caches for a specific repository
   */
  clearRepo(repoPath) {
    this.mergeBaseCache.delete(repoPath);
    this.ancestryCache.delete(repoPath);
    this.commitCache.delete(repoPath);
    this.generationCache.delete(repoPath);
  }

  /**
   * Clear all caches
   */
  clearAll() {
    this.mergeBaseCache.clear();
    this.ancestryCache.clear();
    this.commitCache.clear();
    this.generationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(repoPath) {
    return {
      mergeBaseEntries: this.mergeBaseCache.get(repoPath)?.size || 0,
      ancestryEntries: this.ancestryCache.get(repoPath)?.size || 0,
      commitEntries: this.commitCache.get(repoPath)?.size || 0,
      generationEntries: this.generationCache.get(repoPath)?.size || 0,
    };
  }
}

/**
 * Global cache instance (can be replaced with a custom instance)
 */
const globalCache = new MergeBaseCache();

/**
 * Read a commit object from the repository
 */
async function readCommit(dir, oid, cache) {
  // Check cache first
  const cached = cache.getCommit(dir, oid);
  if (cached) return cached;

  // Read from git
  const commit = await git.readCommit({ fs, dir, oid });

  // Cache the commit
  cache.setCommit(dir, oid, commit);

  // Also cache the parents
  cache.setParents(dir, oid, commit.commit.parent);

  return commit;
}

/**
 * Get parents of a commit (with caching)
 */
async function getParents(dir, oid, cache) {
  // Check cache first
  const cached = cache.getParents(dir, oid);
  if (cached) return Array.from(cached);

  // Read commit to get parents
  const commit = await readCommit(dir, oid, cache);
  return commit.commit.parent;
}

/**
 * Calculate generation number (distance from root) for a commit
 * Uses dynamic programming with memoization
 */
async function getGenerationNumber(dir, oid, cache) {
  // Check cache
  const cached = cache.getGeneration(dir, oid);
  if (cached !== null) return cached;

  // Get parents
  const parents = await getParents(dir, oid, cache);

  if (parents.length === 0) {
    // Root commit has generation 0
    cache.setGeneration(dir, oid, 0);
    return 0;
  }

  // Generation is 1 + max(parent generations)
  const parentGenerations = await Promise.all(
    parents.map(parentOid => getGenerationNumber(dir, parentOid, cache))
  );
  const generation = 1 + Math.max(...parentGenerations);

  cache.setGeneration(dir, oid, generation);
  return generation;
}

/**
 * Find merge-base using parallel BFS with generation number optimization
 *
 * Algorithm:
 * 1. Start BFS from both commits simultaneously
 * 2. Use generation numbers to prioritize exploration (explore higher generations first)
 * 3. Track visited commits from each side
 * 4. First commit visited from both sides is the merge-base
 * 5. All operations are memoized for subsequent calls
 *
 * @param {string} dir - Repository directory path
 * @param {string} oid1 - First commit OID
 * @param {string} oid2 - Second commit OID
 * @param {MergeBaseCache} cache - Cache instance (defaults to global cache)
 * @returns {Promise<string>} - OID of the merge-base commit
 */
async function findMergeBase(dir, oid1, oid2, cache = globalCache) {
  // Normalize OIDs if needed (resolve refs to full OIDs)
  const resolvedOid1 = await resolveRef(dir, oid1);
  const resolvedOid2 = await resolveRef(dir, oid2);

  // Check if commits are the same
  if (resolvedOid1 === resolvedOid2) {
    return resolvedOid1;
  }

  // Check cache
  const cachedResult = cache.getMergeBase(dir, resolvedOid1, resolvedOid2);
  if (cachedResult) {
    return cachedResult;
  }

  // Priority queue implementation (min-heap based on negative generation)
  // We want to explore higher generation numbers first
  class PriorityQueue {
    constructor() {
      this.items = [];
    }

    enqueue(oid, generation, side) {
      this.items.push({ oid, generation, side });
      this.items.sort((a, b) => b.generation - a.generation); // Higher generation first
    }

    dequeue() {
      return this.items.shift();
    }

    isEmpty() {
      return this.items.length === 0;
    }

    size() {
      return this.items.length;
    }
  }

  // Initialize BFS
  const queue = new PriorityQueue();
  const visited1 = new Set([resolvedOid1]); // Commits reachable from oid1
  const visited2 = new Set([resolvedOid2]); // Commits reachable from oid2

  // Get initial generation numbers
  const gen1 = await getGenerationNumber(dir, resolvedOid1, cache);
  const gen2 = await getGenerationNumber(dir, resolvedOid2, cache);

  queue.enqueue(resolvedOid1, gen1, 1);
  queue.enqueue(resolvedOid2, gen2, 2);

  // BFS traversal
  while (!queue.isEmpty()) {
    const { oid, generation, side } = queue.dequeue();

    // Check if this commit has been visited from the other side
    if (side === 1 && visited2.has(oid)) {
      // Found merge-base
      cache.setMergeBase(dir, resolvedOid1, resolvedOid2, oid);
      return oid;
    }
    if (side === 2 && visited1.has(oid)) {
      // Found merge-base
      cache.setMergeBase(dir, resolvedOid1, resolvedOid2, oid);
      return oid;
    }

    // Get parents and add to queue
    const parents = await getParents(dir, oid, cache);

    for (const parentOid of parents) {
      const visitedSet = side === 1 ? visited1 : visited2;

      if (!visitedSet.has(parentOid)) {
        visitedSet.add(parentOid);
        const parentGen = await getGenerationNumber(dir, parentOid, cache);
        queue.enqueue(parentOid, parentGen, side);
      }
    }
  }

  // No merge-base found (disconnected histories)
  throw new Error(`No merge-base found between ${oid1} and ${oid2}`);
}

/**
 * Resolve a ref (branch name, tag, etc.) to a full commit OID
 */
async function resolveRef(dir, ref) {
  try {
    // Try to resolve as a ref first
    const oid = await git.resolveRef({ fs, dir, ref });
    return oid;
  } catch (err) {
    // If it fails, assume it's already an OID
    // Validate it's a valid OID format (40 hex chars)
    if (/^[0-9a-f]{40}$/i.test(ref)) {
      return ref;
    }
    // Try to expand a short OID
    if (/^[0-9a-f]{4,40}$/i.test(ref)) {
      const expanded = await git.expandOid({ fs, dir, oid: ref });
      return expanded;
    }
    throw new Error(`Invalid ref or OID: ${ref}`);
  }
}

/**
 * Find merge-base between multiple commits (octopus merge)
 *
 * For N commits, finds the common ancestor by iteratively finding
 * the merge-base of pairs.
 *
 * @param {string} dir - Repository directory path
 * @param {string[]} oids - Array of commit OIDs
 * @param {MergeBaseCache} cache - Cache instance (defaults to global cache)
 * @returns {Promise<string>} - OID of the common merge-base
 */
async function findMergeBaseMultiple(dir, oids, cache = globalCache) {
  if (oids.length === 0) {
    throw new Error('At least one commit OID is required');
  }
  if (oids.length === 1) {
    return await resolveRef(dir, oids[0]);
  }
  if (oids.length === 2) {
    return await findMergeBase(dir, oids[0], oids[1], cache);
  }

  // For multiple commits, find merge-base iteratively
  let result = await findMergeBase(dir, oids[0], oids[1], cache);

  for (let i = 2; i < oids.length; i++) {
    result = await findMergeBase(dir, result, oids[i], cache);
  }

  return result;
}

/**
 * Check if one commit is an ancestor of another
 *
 * @param {string} dir - Repository directory path
 * @param {string} ancestorOid - Potential ancestor commit OID
 * @param {string} descendantOid - Potential descendant commit OID
 * @param {MergeBaseCache} cache - Cache instance (defaults to global cache)
 * @returns {Promise<boolean>} - True if ancestorOid is an ancestor of descendantOid
 */
async function isAncestor(dir, ancestorOid, descendantOid, cache = globalCache) {
  const mergeBase = await findMergeBase(dir, ancestorOid, descendantOid, cache);
  const resolvedAncestor = await resolveRef(dir, ancestorOid);
  return mergeBase === resolvedAncestor;
}

/**
 * Get all common ancestors between two commits
 *
 * Returns all commits that are ancestors of both input commits,
 * not just the best merge-base.
 *
 * @param {string} dir - Repository directory path
 * @param {string} oid1 - First commit OID
 * @param {string} oid2 - Second commit OID
 * @param {MergeBaseCache} cache - Cache instance (defaults to global cache)
 * @returns {Promise<string[]>} - Array of common ancestor OIDs
 */
async function findAllCommonAncestors(dir, oid1, oid2, cache = globalCache) {
  const resolvedOid1 = await resolveRef(dir, oid1);
  const resolvedOid2 = await resolveRef(dir, oid2);

  if (resolvedOid1 === resolvedOid2) {
    return [resolvedOid1];
  }

  // BFS to find all ancestors of both commits
  const ancestors1 = await getAllAncestors(dir, resolvedOid1, cache);
  const ancestors2 = await getAllAncestors(dir, resolvedOid2, cache);

  // Find intersection
  const commonAncestors = [...ancestors1].filter(oid => ancestors2.has(oid));

  return commonAncestors;
}

/**
 * Get all ancestors of a commit using BFS
 */
async function getAllAncestors(dir, oid, cache) {
  const ancestors = new Set();
  const queue = [oid];
  const visited = new Set([oid]);

  while (queue.length > 0) {
    const currentOid = queue.shift();
    ancestors.add(currentOid);

    const parents = await getParents(dir, currentOid, cache);

    for (const parentOid of parents) {
      if (!visited.has(parentOid)) {
        visited.add(parentOid);
        queue.push(parentOid);
      }
    }
  }

  return ancestors;
}

/**
 * Create a new cache instance for isolated caching
 */
function createCache() {
  return new MergeBaseCache();
}

module.exports = {
  findMergeBase,
  findMergeBaseMultiple,
  isAncestor,
  findAllCommonAncestors,
  createCache,
  globalCache,
  MergeBaseCache,
};
