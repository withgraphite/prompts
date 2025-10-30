/**
 * Git utilities module
 *
 * Low-level git operations using isomorphic-git with optimized memoization
 */

const mergeBase = require('./merge-base');

module.exports = {
  // Re-export all merge-base functions
  ...mergeBase,

  // Aliases for common operations
  mergeBase: mergeBase.findMergeBase,
};
