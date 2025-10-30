/**
 * Example usage of git-utils merge-base implementation
 */

const path = require('path');
const { findMergeBase, isAncestor, createCache, findMergeBaseMultiple } = require('./index');

async function main() {
  // Example 1: Find merge-base between two branches
  console.log('Example 1: Basic merge-base');
  console.log('===========================');

  // Assuming this is run in a git repository
  const repoPath = process.cwd();

  try {
    // Find merge-base between main and current HEAD
    const mergeBase = await findMergeBase(repoPath, 'HEAD', 'main');
    console.log(`Merge base between HEAD and main: ${mergeBase.substring(0, 8)}`);
  } catch (err) {
    console.log(`Note: ${err.message}`);
  }

  console.log('\n');

  // Example 2: Using a custom cache
  console.log('Example 2: Custom cache with statistics');
  console.log('========================================');

  const cache = createCache();

  try {
    // First call - cold cache
    const start1 = Date.now();
    const mb1 = await findMergeBase(repoPath, 'HEAD', 'main', cache);
    const time1 = Date.now() - start1;
    console.log(`First call (cold cache): ${time1}ms`);

    // Second call - warm cache
    const start2 = Date.now();
    const mb2 = await findMergeBase(repoPath, 'HEAD', 'main', cache);
    const time2 = Date.now() - start2;
    console.log(`Second call (warm cache): ${time2}ms`);
    console.log(`Speedup: ${(time1 / time2).toFixed(1)}x faster`);

    // Show cache stats
    const stats = cache.getStats(repoPath);
    console.log('\nCache statistics:');
    console.log(`- Merge-base entries: ${stats.mergeBaseEntries}`);
    console.log(`- Ancestry entries: ${stats.ancestryEntries}`);
    console.log(`- Commit entries: ${stats.commitEntries}`);
    console.log(`- Generation entries: ${stats.generationEntries}`);
  } catch (err) {
    console.log(`Note: ${err.message}`);
  }

  console.log('\n');

  // Example 3: Check ancestry
  console.log('Example 3: Ancestry check');
  console.log('=========================');

  try {
    const result = await isAncestor(repoPath, 'HEAD~5', 'HEAD');
    if (result) {
      console.log('HEAD~5 is an ancestor of HEAD ✓');
    } else {
      console.log('HEAD~5 is NOT an ancestor of HEAD');
    }

    const result2 = await isAncestor(repoPath, 'HEAD', 'HEAD~5');
    if (result2) {
      console.log('HEAD is an ancestor of HEAD~5');
    } else {
      console.log('HEAD is NOT an ancestor of HEAD~5 ✓');
    }
  } catch (err) {
    console.log(`Note: ${err.message}`);
  }

  console.log('\n');

  // Example 4: Multiple commits (octopus merge)
  console.log('Example 4: Octopus merge (multiple commits)');
  console.log('============================================');

  try {
    const commits = ['HEAD', 'HEAD~1', 'HEAD~2', 'HEAD~3'];
    const mergeBase = await findMergeBaseMultiple(repoPath, commits);
    console.log(`Merge base of ${commits.join(', ')}: ${mergeBase.substring(0, 8)}`);
  } catch (err) {
    console.log(`Note: ${err.message}`);
  }

  console.log('\n');

  // Example 5: Performance test
  console.log('Example 5: Performance benchmark');
  console.log('================================');

  const perfCache = createCache();
  const iterations = 100;

  try {
    // Warm up the cache
    await findMergeBase(repoPath, 'HEAD', 'HEAD~10', perfCache);

    // Run benchmark
    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
      await findMergeBase(repoPath, 'HEAD', 'HEAD~10', perfCache);
    }
    const elapsed = Date.now() - start;
    const avgTime = elapsed / iterations;

    console.log(`${iterations} iterations completed in ${elapsed}ms`);
    console.log(`Average time per call: ${avgTime.toFixed(2)}ms`);
    console.log(`Throughput: ${(1000 / avgTime).toFixed(0)} calls/second`);
  } catch (err) {
    console.log(`Note: ${err.message}`);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = { main };
