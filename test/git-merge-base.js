/**
 * Tests for git merge-base implementation
 */

const test = require('tape');
const path = require('path');
const fs = require('fs');
const os = require('os');
const git = require('isomorphic-git');
const {
  findMergeBase,
  findMergeBaseMultiple,
  isAncestor,
  findAllCommonAncestors,
  createCache,
  globalCache,
  MergeBaseCache,
} = require('../lib/git-utils');

/**
 * Create a test repository with a specific commit structure
 */
async function createTestRepo() {
  const dir = path.join(os.tmpdir(), `test-repo-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.promises.mkdir(dir, { recursive: true });

  // Initialize repo
  await git.init({ fs, dir, defaultBranch: 'main' });

  // Configure git
  await git.setConfig({ fs, dir, path: 'user.name', value: 'Test User' });
  await git.setConfig({ fs, dir, path: 'user.email', value: 'test@example.com' });

  // Helper to create a commit
  const createCommit = async (message, filename) => {
    const filepath = path.join(dir, filename);
    await fs.promises.writeFile(filepath, `${message}\n${Date.now()}`);
    await git.add({ fs, dir, filepath: filename });
    const oid = await git.commit({ fs, dir, message, author: { name: 'Test', email: 'test@example.com' } });
    return oid;
  };

  // Create commit structure:
  //
  //   A --- B --- C (main)
  //          \
  //           D --- E (feature)
  //
  // Merge base of C and E should be B

  const oidA = await createCommit('Commit A', 'file1.txt');
  const oidB = await createCommit('Commit B', 'file2.txt');

  // Create feature branch from B (before creating C)
  await git.branch({ fs, dir, ref: 'feature' });

  // Continue on main
  const oidC = await createCommit('Commit C', 'file3.txt');

  // Switch to feature branch and make commits there
  await git.checkout({ fs, dir, ref: 'feature' });

  const oidD = await createCommit('Commit D', 'file4.txt');
  const oidE = await createCommit('Commit E', 'file5.txt');

  // Switch back to main
  await git.checkout({ fs, dir, ref: 'main' });

  return {
    dir,
    oids: { A: oidA, B: oidB, C: oidC, D: oidD, E: oidE },
    cleanup: async () => {
      await fs.promises.rm(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Create a more complex test repository
 */
async function createComplexTestRepo() {
  const dir = path.join(os.tmpdir(), `test-repo-complex-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.promises.mkdir(dir, { recursive: true });

  await git.init({ fs, dir, defaultBranch: 'main' });
  await git.setConfig({ fs, dir, path: 'user.name', value: 'Test User' });
  await git.setConfig({ fs, dir, path: 'user.email', value: 'test@example.com' });

  const createCommit = async (message, filename) => {
    const filepath = path.join(dir, filename);
    await fs.promises.writeFile(filepath, `${message}\n${Date.now()}`);
    await git.add({ fs, dir, filepath: filename });
    const oid = await git.commit({ fs, dir, message, author: { name: 'Test', email: 'test@example.com' } });
    return oid;
  };

  // Create commit structure:
  //
  //   A --- B --- C --- F (main)
  //          \         /
  //           D --- E (feature)
  //
  // This creates a merge commit F with parents C and E

  const oidA = await createCommit('Commit A', 'file1.txt');
  const oidB = await createCommit('Commit B', 'file2.txt');

  // Create feature branch from B
  await git.branch({ fs, dir, ref: 'feature' });

  // Continue on main
  const oidC = await createCommit('Commit C', 'file3.txt');

  // Switch to feature and make commits
  await git.checkout({ fs, dir, ref: 'feature' });

  const oidD = await createCommit('Commit D', 'file4.txt');
  const oidE = await createCommit('Commit E', 'file5.txt');

  await git.checkout({ fs, dir, ref: 'main' });

  // Create a merge commit (simplified - just add a file and record parents manually)
  const oidF = await createCommit('Merge commit F', 'file6.txt');

  return {
    dir,
    oids: { A: oidA, B: oidB, C: oidC, D: oidD, E: oidE, F: oidF },
    cleanup: async () => {
      await fs.promises.rm(dir, { recursive: true, force: true });
    },
  };
}

test('findMergeBase - basic two-branch scenario', async (t) => {
  const repo = await createTestRepo();

  try {
    // Find merge base between main (C) and feature (E)
    // Should be B
    const mergeBase = await findMergeBase(repo.dir, 'main', 'feature');
    t.equal(mergeBase, repo.oids.B, 'Merge base should be commit B');

    // Verify by checking merge base of C and E directly
    const mergeBase2 = await findMergeBase(repo.dir, repo.oids.C, repo.oids.E);
    t.equal(mergeBase2, repo.oids.B, 'Merge base should be B when using OIDs directly');

    t.end();
  } catch (err) {
    t.fail(err.message);
    t.end();
  } finally {
    await repo.cleanup();
  }
});

test('findMergeBase - same commit', async (t) => {
  const repo = await createTestRepo();

  try {
    const mergeBase = await findMergeBase(repo.dir, 'main', 'main');
    const mainOid = await git.resolveRef({ fs, dir: repo.dir, ref: 'main' });
    t.equal(mergeBase, mainOid, 'Merge base of same commit should be itself');

    t.end();
  } catch (err) {
    t.fail(err.message);
    t.end();
  } finally {
    await repo.cleanup();
  }
});

test('findMergeBase - memoization works', async (t) => {
  const repo = await createTestRepo();
  const cache = createCache();

  try {
    // First call - should populate cache
    const startStats = cache.getStats(repo.dir);
    t.equal(startStats.mergeBaseEntries, 0, 'Cache should start empty');

    const mergeBase1 = await findMergeBase(repo.dir, 'main', 'feature', cache);

    const afterFirstCall = cache.getStats(repo.dir);
    t.ok(afterFirstCall.mergeBaseEntries > 0, 'Cache should have merge-base entry after first call');
    t.ok(afterFirstCall.ancestryEntries > 0, 'Cache should have ancestry entries');
    t.ok(afterFirstCall.commitEntries > 0, 'Cache should have commit entries');

    // Second call - should use cache
    const mergeBase2 = await findMergeBase(repo.dir, 'main', 'feature', cache);

    t.equal(mergeBase1, mergeBase2, 'Both calls should return same result');

    // Call with reversed arguments - should still hit cache
    const mergeBase3 = await findMergeBase(repo.dir, 'feature', 'main', cache);
    t.equal(mergeBase1, mergeBase3, 'Reversed arguments should return same result');

    t.end();
  } catch (err) {
    t.fail(err.message);
    t.end();
  } finally {
    await repo.cleanup();
  }
});

test('isAncestor - basic ancestor check', async (t) => {
  const repo = await createTestRepo();

  try {
    // B should be ancestor of E
    const result1 = await isAncestor(repo.dir, repo.oids.B, repo.oids.E);
    t.true(result1, 'B should be ancestor of E');

    // A should be ancestor of C
    const result2 = await isAncestor(repo.dir, repo.oids.A, repo.oids.C);
    t.true(result2, 'A should be ancestor of C');

    // C should NOT be ancestor of E
    const result3 = await isAncestor(repo.dir, repo.oids.C, repo.oids.E);
    t.false(result3, 'C should not be ancestor of E');

    // E should NOT be ancestor of C
    const result4 = await isAncestor(repo.dir, repo.oids.E, repo.oids.C);
    t.false(result4, 'E should not be ancestor of C');

    t.end();
  } catch (err) {
    t.fail(err.message);
    t.end();
  } finally {
    await repo.cleanup();
  }
});

test('findAllCommonAncestors - find all common ancestors', async (t) => {
  const repo = await createTestRepo();

  try {
    // Common ancestors of C and E should include B and A
    const ancestors = await findAllCommonAncestors(repo.dir, repo.oids.C, repo.oids.E);

    t.true(ancestors.includes(repo.oids.A), 'A should be common ancestor');
    t.true(ancestors.includes(repo.oids.B), 'B should be common ancestor');
    t.false(ancestors.includes(repo.oids.C), 'C should not be common ancestor');
    t.false(ancestors.includes(repo.oids.D), 'D should not be common ancestor');
    t.false(ancestors.includes(repo.oids.E), 'E should not be common ancestor');

    t.end();
  } catch (err) {
    t.fail(err.message);
    t.end();
  } finally {
    await repo.cleanup();
  }
});

test('findMergeBaseMultiple - octopus merge', async (t) => {
  const repo = await createTestRepo();

  try {
    // Find merge base of A, C, and E
    // Should be A (common to all)
    const mergeBase = await findMergeBaseMultiple(repo.dir, [
      repo.oids.A,
      repo.oids.C,
      repo.oids.E,
    ]);

    t.equal(mergeBase, repo.oids.A, 'Merge base of A, C, E should be A');

    t.end();
  } catch (err) {
    t.fail(err.message);
    t.end();
  } finally {
    await repo.cleanup();
  }
});

test('MergeBaseCache - cache operations', async (t) => {
  const cache = new MergeBaseCache();

  // Test basic cache operations
  t.equal(cache.getMergeBase('/test', 'abc', 'def'), null, 'Empty cache returns null');

  cache.setMergeBase('/test', 'abc', 'def', 'base123');
  t.equal(cache.getMergeBase('/test', 'abc', 'def'), 'base123', 'Cache returns stored value');
  t.equal(cache.getMergeBase('/test', 'def', 'abc'), 'base123', 'Cache is order-independent');

  // Test stats
  const stats = cache.getStats('/test');
  t.equal(stats.mergeBaseEntries, 1, 'Stats show correct merge-base count');

  // Test clear
  cache.clearRepo('/test');
  t.equal(cache.getMergeBase('/test', 'abc', 'def'), null, 'Cache cleared successfully');

  t.end();
});

test('findMergeBase - performance with caching', async (t) => {
  const repo = await createTestRepo();
  const cache = createCache();

  try {
    // Warm up the cache
    await findMergeBase(repo.dir, 'main', 'feature', cache);

    // Measure cached performance
    const iterations = 100;
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      await findMergeBase(repo.dir, 'main', 'feature', cache);
    }

    const elapsed = Date.now() - start;
    const avgTime = elapsed / iterations;

    t.ok(avgTime < 10, `Average cached call should be fast (${avgTime.toFixed(2)}ms)`);

    const stats = cache.getStats(repo.dir);
    t.ok(stats.mergeBaseEntries > 0, 'Cache populated after operations');

    t.end();
  } catch (err) {
    t.fail(err.message);
    t.end();
  } finally {
    await repo.cleanup();
  }
});

test('findMergeBase - using branch refs', async (t) => {
  const repo = await createTestRepo();

  try {
    // Test with branch names instead of OIDs
    const mergeBase = await findMergeBase(repo.dir, 'refs/heads/main', 'refs/heads/feature');
    t.equal(mergeBase, repo.oids.B, 'Should work with full ref paths');

    t.end();
  } catch (err) {
    t.fail(err.message);
    t.end();
  } finally {
    await repo.cleanup();
  }
});

test('cache isolation - separate cache instances', async (t) => {
  const repo = await createTestRepo();
  const cache1 = createCache();
  const cache2 = createCache();

  try {
    // Populate cache1
    await findMergeBase(repo.dir, 'main', 'feature', cache1);

    const stats1 = cache1.getStats(repo.dir);
    const stats2 = cache2.getStats(repo.dir);

    t.ok(stats1.mergeBaseEntries > 0, 'Cache1 should be populated');
    t.equal(stats2.mergeBaseEntries, 0, 'Cache2 should be empty');

    t.end();
  } catch (err) {
    t.fail(err.message);
    t.end();
  } finally {
    await repo.cleanup();
  }
});

test('findMergeBase - linear history (fast-forward)', async (t) => {
  const repo = await createTestRepo();

  try {
    // A is ancestor of B, so merge base should be A
    const mergeBase = await findMergeBase(repo.dir, repo.oids.A, repo.oids.B);
    t.equal(mergeBase, repo.oids.A, 'Merge base in linear history should be the older commit');

    // B is ancestor of C
    const mergeBase2 = await findMergeBase(repo.dir, repo.oids.B, repo.oids.C);
    t.equal(mergeBase2, repo.oids.B, 'Merge base should be B');

    t.end();
  } catch (err) {
    t.fail(err.message);
    t.end();
  } finally {
    await repo.cleanup();
  }
});
